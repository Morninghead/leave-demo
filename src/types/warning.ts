export enum WarningStatus {
    DRAFT = 'DRAFT',
    PENDING_REVIEW = 'PENDING_REVIEW',
    APPROVED = 'APPROVED',
    ACTIVE = 'ACTIVE',
    PENDING_ACKNOWLEDGEMENT = 'PENDING_ACKNOWLEDGEMENT',
    ACKNOWLEDGED = 'ACKNOWLEDGED',
    REFUSED = 'REFUSED',
    EXPIRED = 'EXPIRED',
    CANCELLED = 'CANCELLED'
}

export enum WarningType {
    VERBAL = 'VERBAL',
    WRITTEN_1ST = 'WRITTEN_1ST',
    WRITTEN_2ND = 'WRITTEN_2ND',
    FINAL_WARNING = 'FINAL_WARNING',
    SUSPENSION = 'SUSPENSION',
    TERMINATION = 'TERMINATION'
}

export interface WarningWitness {
    witness_name: string;
    witness_position?: string;
    statement?: string;
}

export interface WarningNotice {
    id: string;
    notice_number: string;
    warning_type: WarningType | string;
    incident_date: string;
    incident_description: string;
    incident_location?: string;
    offense_name_th: string;
    offense_name_en: string;
    severity_level?: number;
    penalty_description: string;
    suspension_days?: number;
    suspension_start_date?: string;
    suspension_end_date?: string;
    attachments_urls?: string[];
    witnesses?: WarningWitness[];

    // Issuer Info
    issuer_id: string;
    issuer_first_name_th: string;
    issuer_last_name_th: string;
    issuer_first_name_en: string;
    issuer_last_name_en: string;
    issuer_position_th?: string;
    issuer_position_en?: string;

    // Employee Info (for Manager View)
    employee_id?: string;
    employee_code?: string;
    employee_first_name_th?: string;
    employee_last_name_th?: string;
    employee_first_name_en?: string;
    employee_last_name_en?: string;
    employee_position_th?: string;
    employee_position_en?: string;

    // Status & Dates
    status: WarningStatus | string;
    effective_date: string;
    expiry_date?: string;
    created_at: string;
    updated_at: string;

    // Acknowledgement
    acknowledged_at?: string;
    refused_at?: string;
    refusal_reason?: string;
    employee_signature_url?: string;

    // Manager Acknowledgement
    manager_acknowledged?: boolean;
}
