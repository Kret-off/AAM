erDiagram
  USER {
    uuid id PK
    string email UNIQUE
    string password_hash
    string name
    string role "USER|ADMIN"
    datetime created_at
    datetime last_login_at
    boolean is_active
  }

  CLIENT {
    uuid id PK
    string name
    text client_context_summary_md
    datetime created_at
    uuid created_by_user_id FK
    datetime updated_at
  }

  MEETING_TYPE {
    uuid id PK
    string name "First|Follow-up|CP Presentation"
    boolean is_active
  }

  PROMPT_SCENARIO {
    uuid id PK
    uuid meeting_type_id FK
    string name
    text system_prompt
    json output_schema
    json artifacts_config
    boolean is_active
    int version
    datetime updated_at
    uuid updated_by_user_id FK
  }

  DIRECTORY_PARTICIPANT {
    uuid id PK
    string type "internal|external"
    string full_name
    string role_title
    string company_name
    string department
    json tags
    boolean is_active
    datetime created_at
    uuid created_by_user_id FK
  }

  MEETING {
    uuid id PK
    uuid client_id FK
    uuid owner_user_id FK
    uuid meeting_type_id FK
    uuid scenario_id FK
    string title
    string status "Uploaded|Transcribing|LLM_Processing|Ready|Validated|Rejected|Failed_*"
    datetime created_at
    datetime validated_at
  }

  MEETING_PARTICIPANT {
    uuid meeting_id FK
    uuid participant_id FK
    string snapshot_full_name
    string snapshot_role_title
    string snapshot_company_name
    string snapshot_department
    datetime added_at
    %% composite PK: (meeting_id, participant_id)
  }

  MEETING_VIEWER {
    uuid meeting_id FK
    uuid user_id FK
    datetime added_at
    uuid added_by_user_id FK
    %% composite PK: (meeting_id, user_id)
  }

  UPLOAD_BLOB {
    uuid id PK
    uuid meeting_id FK UNIQUE
    string original_filename
    string mime_type
    bigint size_bytes
    string storage_path
    datetime expires_at
    datetime deleted_at
    datetime created_at
  }

  TRANSCRIPT {
    uuid id PK
    uuid meeting_id FK UNIQUE
    text transcript_text
    json segments
    json keyterms
    string language
    datetime created_at
  }

  ARTIFACTS {
    uuid id PK
    uuid meeting_id FK UNIQUE
    json artifacts_payload
    datetime created_at
  }

  VALIDATION {
    uuid id PK
    uuid meeting_id FK UNIQUE
    uuid validated_by_user_id FK
    string decision "accepted|rejected"
    text rejection_reason
    datetime validated_at
  }

  USER ||--o{ CLIENT : "creates"
  USER ||--o{ MEETING : "owns"
  USER ||--o{ MEETING_VIEWER : "is viewer"
  USER ||--o{ DIRECTORY_PARTICIPANT : "creates"
  USER ||--o{ PROMPT_SCENARIO : "updates"
  USER ||--o{ VALIDATION : "validates"

  CLIENT ||--o{ MEETING : "has"
  MEETING_TYPE ||--o{ PROMPT_SCENARIO : "has"
  MEETING_TYPE ||--o{ MEETING : "categorizes"
  PROMPT_SCENARIO ||--o{ MEETING : "drives"

  MEETING ||--|| UPLOAD_BLOB : "temporary file"
  MEETING ||--|| TRANSCRIPT : "produces"
  MEETING ||--|| ARTIFACTS : "produces"
  MEETING ||--|| VALIDATION : "has"

  MEETING ||--o{ MEETING_PARTICIPANT : "includes"
  DIRECTORY_PARTICIPANT ||--o{ MEETING_PARTICIPANT : "appears in"

  MEETING ||--o{ MEETING_VIEWER : "shared with"