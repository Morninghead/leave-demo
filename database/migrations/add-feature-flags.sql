-- Migration: Add Feature Flags System for Mobile UX A/B Testing
-- Created: 2026-01-30
-- Purpose: Enable zero-downtime rollout of mobile UX improvements

-- ============================================
-- Feature Flags Configuration Table
-- ============================================
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT false,
    rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
    target_roles TEXT[] DEFAULT '{}', -- e.g., ['hr', 'manager', 'dev']
    target_departments UUID[] DEFAULT '{}',
    allow_opt_in BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE feature_flags IS 'Configuration for feature flags used in A/B testing and gradual rollouts';
COMMENT ON COLUMN feature_flags.flag_name IS 'Unique identifier for the feature flag';
COMMENT ON COLUMN feature_flags.rollout_percentage IS 'Percentage of users who should see the new feature (0-100)';
COMMENT ON COLUMN feature_flags.allow_opt_in IS 'Whether users can opt-in to the feature before general rollout';

-- ============================================
-- User Feature Preferences Table
-- ============================================
CREATE TABLE IF NOT EXISTS user_feature_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    flag_name VARCHAR(100) NOT NULL,
    opted_in BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, flag_name)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_feature_preferences_user_id ON user_feature_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feature_preferences_flag_name ON user_feature_preferences(flag_name);

COMMENT ON TABLE user_feature_preferences IS 'User-specific opt-in preferences for feature flags';

-- ============================================
-- Analytics Events Table for A/B Testing
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    session_id VARCHAR(100),
    feature_flag VARCHAR(100),
    variant VARCHAR(50), -- 'control' or 'treatment'
    metadata JSONB DEFAULT '{}',
    device_info JSONB DEFAULT '{}', -- { deviceType, screenWidth, os }
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_feature_flag ON analytics_events(feature_flag);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_events_variant ON analytics_events(variant);

COMMENT ON TABLE analytics_events IS 'Analytics events for tracking A/B test performance and user behavior';

-- ============================================
-- Insert Initial Feature Flag for Mobile UX V2
-- ============================================
INSERT INTO feature_flags (
    flag_name,
    description,
    enabled,
    rollout_percentage,
    target_roles,
    allow_opt_in
) VALUES (
    'mobileUXV2',
    'New mobile UX improvements including better touch targets, improved navigation, and keyboard handling',
    false,
    0,
    ARRAY['dev', 'hr'],
    true
) ON CONFLICT (flag_name) DO NOTHING;

-- ============================================
-- Create Updated At Trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to feature_flags
DROP TRIGGER IF EXISTS update_feature_flags_updated_at ON feature_flags;
CREATE TRIGGER update_feature_flags_updated_at
    BEFORE UPDATE ON feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to user_feature_preferences
DROP TRIGGER IF EXISTS update_user_feature_preferences_updated_at ON user_feature_preferences;
CREATE TRIGGER update_user_feature_preferences_updated_at
    BEFORE UPDATE ON user_feature_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Enable RLS (Row Level Security)
-- ============================================
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feature_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Policies for feature_flags (readable by all authenticated, writable by admin/hr/dev)
CREATE POLICY feature_flags_select_policy ON feature_flags
    FOR SELECT TO authenticated USING (true);

CREATE POLICY feature_flags_modify_policy ON feature_flags
    FOR ALL TO authenticated 
    USING (auth.jwt() ->> 'role' IN ('admin', 'hr', 'dev'))
    WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'hr', 'dev'));

-- Policies for user_feature_preferences (users can only see/modify their own)
CREATE POLICY user_feature_preferences_select_policy ON user_feature_preferences
    FOR SELECT TO authenticated 
    USING (user_id = auth.uid() OR auth.jwt() ->> 'role' IN ('admin', 'hr'));

CREATE POLICY user_feature_preferences_modify_policy ON user_feature_preferences
    FOR ALL TO authenticated 
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policies for analytics_events (insert by all, read by admin/hr/dev only)
CREATE POLICY analytics_events_insert_policy ON analytics_events
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY analytics_events_select_policy ON analytics_events
    FOR SELECT TO authenticated 
    USING (auth.jwt() ->> 'role' IN ('admin', 'hr', 'dev'));

-- ============================================
-- Create Helper Functions
-- ============================================

-- Function to check if user should see feature
CREATE OR REPLACE FUNCTION should_show_feature(
    p_user_id UUID,
    p_flag_name VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    v_flag feature_flags%ROWTYPE;
    v_user_hash INTEGER;
    v_opted_in BOOLEAN;
BEGIN
    -- Get flag configuration
    SELECT * INTO v_flag FROM feature_flags WHERE flag_name = p_flag_name;
    
    -- If flag doesn't exist or is disabled, return false
    IF v_flag IS NULL OR NOT v_flag.enabled THEN
        RETURN false;
    END IF;
    
    -- Check if user has opted in
    SELECT opted_in INTO v_opted_in 
    FROM user_feature_preferences 
    WHERE user_id = p_user_id AND flag_name = p_flag_name;
    
    IF v_opted_in THEN
        RETURN true;
    END IF;
    
    -- Check if rollout is 100%
    IF v_flag.rollout_percentage >= 100 THEN
        RETURN true;
    END IF;
    
    -- Check if rollout is 0%
    IF v_flag.rollout_percentage <= 0 THEN
        RETURN false;
    END IF;
    
    -- Consistent hashing based on user_id
    v_user_hash := abs(('x' || substr(md5(p_user_id::text), 1, 8))::bit(32)::int);
    
    -- Check if user falls within rollout percentage
    RETURN (v_user_hash % 100) < v_flag.rollout_percentage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION should_show_feature IS 'Determines if a user should see a feature based on rollout percentage and opt-in status';

-- ============================================
-- Grant Permissions
-- ============================================
GRANT SELECT ON feature_flags TO authenticated;
GRANT ALL ON user_feature_preferences TO authenticated;
GRANT INSERT ON analytics_events TO authenticated;

-- ============================================
-- Verification Query
-- ============================================
-- Uncomment to verify the migration:
-- SELECT * FROM feature_flags;
-- SELECT * FROM user_feature_preferences LIMIT 5;
-- SELECT should_show_feature('your-user-uuid-here', 'mobileUXV2');