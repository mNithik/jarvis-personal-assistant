use std::{fs, path::Path};

use rusqlite::{params, Connection};

use crate::models::{
    BrowserAliasRecord, HistoryRecord, LearnedIntentRecord, ProposalRecord, ProposalStepInput,
    ProposalStepRecord, ProposalUpdateInput, RoutineRecord, VoiceCorrectionRecord,
};

pub fn init_database(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let connection = Connection::open(path).map_err(|error| error.to_string())?;

    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS routines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                trigger_phrase TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS routine_steps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                routine_id INTEGER NOT NULL,
                step_order INTEGER NOT NULL,
                action_type TEXT NOT NULL,
                action_value TEXT NOT NULL,
                requires_permission INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (routine_id) REFERENCES routines(id)
            );

            CREATE TABLE IF NOT EXISTS action_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                raw_command TEXT NOT NULL,
                resolved_intent TEXT NOT NULL,
                action_status TEXT NOT NULL,
                executed_actions TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS routine_proposals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                trigger_phrase TEXT NOT NULL,
                status TEXT NOT NULL,
                reason_summary TEXT NOT NULL,
                confidence REAL NOT NULL,
                based_on_count INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS routine_proposal_steps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                proposal_id INTEGER NOT NULL,
                step_order INTEGER NOT NULL,
                action_type TEXT NOT NULL,
                action_value TEXT NOT NULL,
                requires_permission INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (proposal_id) REFERENCES routine_proposals(id)
            );

            CREATE TABLE IF NOT EXISTS voice_corrections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                heard_phrase TEXT NOT NULL UNIQUE,
                corrected_phrase TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS local_voice_backend_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                executable_path TEXT,
                model_path TEXT
            );

            CREATE TABLE IF NOT EXISTS local_tts_backend_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                executable_path TEXT,
                model_path TEXT
            );

            CREATE TABLE IF NOT EXISTS wake_mode_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                assistant_name TEXT NOT NULL DEFAULT 'Jarvis',
                wake_mode_enabled INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS browser_aliases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phrase TEXT NOT NULL UNIQUE,
                url TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS ollama_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                base_url TEXT,
                model_name TEXT
            );

            CREATE TABLE IF NOT EXISTS executor_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                command_path TEXT,
                working_directory TEXT
            );

            CREATE TABLE IF NOT EXISTS notion_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                access_token TEXT,
                database_id TEXT
            );

            CREATE TABLE IF NOT EXISTS google_calendar_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                client_id TEXT,
                api_key TEXT
            );

            CREATE TABLE IF NOT EXISTS spotify_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                client_id TEXT
            );

            CREATE TABLE IF NOT EXISTS learned_intents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phrase TEXT NOT NULL,
                normalized_phrase TEXT NOT NULL UNIQUE,
                intent_kind TEXT NOT NULL,
                intent_payload TEXT NOT NULL,
                use_count INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            ",
        )
        .map_err(|error| error.to_string())?;

    seed_study_routine(&connection)?;

    Ok(())
}

fn seed_study_routine(connection: &Connection) -> Result<(), String> {
    let existing_id = connection
        .query_row(
            "SELECT id FROM routines WHERE trigger_phrase = ?1",
            params!["open my study apps"],
            |row| row.get::<_, i64>(0),
        )
        .ok();

    if existing_id.is_some() {
        return Ok(());
    }

    connection
        .execute(
            "INSERT INTO routines (name, description, trigger_phrase) VALUES (?1, ?2, ?3)",
            params![
                "Study Setup",
                "Launches the default study tools for daily focus sessions.",
                "open my study apps"
            ],
        )
        .map_err(|error| error.to_string())?;

    let routine_id = connection.last_insert_rowid();
    let steps = [
        (1, "open_url", "https://calendar.google.com", 0),
        (2, "open_url", "https://docs.google.com", 0),
        (3, "open_app", "code", 0),
        (4, "open_app", "explorer", 0),
    ];

    for (step_order, action_type, action_value, requires_permission) in steps {
        connection
            .execute(
                "INSERT INTO routine_steps (routine_id, step_order, action_type, action_value, requires_permission) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    routine_id,
                    step_order,
                    action_type,
                    action_value,
                    requires_permission
                ],
            )
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

pub fn list_routines(path: &Path) -> Result<Vec<RoutineRecord>, String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT id, name, description, trigger_phrase
             FROM routines
             ORDER BY id ASC",
        )
        .map_err(|error| error.to_string())?;

    let routines = statement
        .query_map([], |row| {
            Ok(RoutineRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                trigger_phrase: row.get(3)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(routines)
}

pub fn list_proposals(path: &Path) -> Result<Vec<ProposalRecord>, String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT id, name, description, trigger_phrase, status, reason_summary, confidence, based_on_count, created_at
             FROM routine_proposals
             ORDER BY id DESC",
        )
        .map_err(|error| error.to_string())?;

    let proposals = statement
        .query_map([], |row| {
            Ok(ProposalRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                trigger_phrase: row.get(3)?,
                status: row.get(4)?,
                reason_summary: row.get(5)?,
                confidence: row.get(6)?,
                based_on_count: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(proposals)
}

pub fn list_proposal_steps(path: &Path, proposal_id: i64) -> Result<Vec<ProposalStepRecord>, String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT id, proposal_id, step_order, action_type, action_value, requires_permission
             FROM routine_proposal_steps
             WHERE proposal_id = ?1
             ORDER BY step_order ASC",
        )
        .map_err(|error| error.to_string())?;

    let steps = statement
        .query_map(params![proposal_id], |row| {
            Ok(ProposalStepRecord {
                id: row.get(0)?,
                proposal_id: row.get(1)?,
                step_order: row.get(2)?,
                action_type: row.get(3)?,
                action_value: row.get(4)?,
                requires_permission: row.get::<_, i64>(5)? == 1,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(steps)
}

pub fn list_history(path: &Path, limit: usize) -> Result<Vec<HistoryRecord>, String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT id, raw_command, resolved_intent, action_status, executed_actions, created_at
             FROM action_history
             ORDER BY id DESC
             LIMIT ?1",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![limit as i64], |row| {
            Ok(HistoryRecord {
                id: row.get(0)?,
                raw_command: row.get(1)?,
                resolved_intent: row.get(2)?,
                action_status: row.get(3)?,
                executed_actions: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(rows)
}

pub fn log_action(
    path: &Path,
    raw_command: &str,
    resolved_intent: &str,
    action_status: &str,
    executed_actions: &str,
) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO action_history (raw_command, resolved_intent, action_status, executed_actions) VALUES (?1, ?2, ?3, ?4)",
            params![raw_command, resolved_intent, action_status, executed_actions],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn generate_study_proposal(path: &Path) -> Result<Option<ProposalRecord>, String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;

    let matching_count: i64 = connection
        .query_row(
            "SELECT COUNT(*)
             FROM action_history
             WHERE resolved_intent = ?1
             AND action_status = ?2",
            params!["launch_study_setup", "success"],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    if matching_count < 2 {
        return Ok(None);
    }

    let existing_pending: Option<i64> = connection
        .query_row(
            "SELECT id
             FROM routine_proposals
             WHERE trigger_phrase = ?1
             AND status = ?2",
            params!["open my evening study apps", "pending_review"],
            |row| row.get(0),
        )
        .ok();

    if existing_pending.is_some() {
        let proposals = list_proposals(path)?;
        return Ok(proposals.into_iter().find(|proposal| {
            proposal.trigger_phrase == "open my evening study apps"
                && proposal.status == "pending_review"
        }));
    }

    connection
        .execute(
            "INSERT INTO routine_proposals (name, description, trigger_phrase, status, reason_summary, confidence, based_on_count) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                "Evening Study Setup",
                "Drafted from repeated study-launch behavior. Opens your core study tools in one suggested routine.",
                "open my evening study apps",
                "pending_review",
                format!(
                    "Observed the study setup routine being launched successfully {} times. JARVIS drafted a dedicated evening routine for review.",
                    matching_count
                ),
                0.72_f64,
                matching_count
            ],
        )
        .map_err(|error| error.to_string())?;

    let proposal_id = connection.last_insert_rowid();
    let steps = [
        (1, "open_url", "https://calendar.google.com", 0),
        (2, "open_url", "https://docs.google.com", 0),
        (3, "open_app", "code", 0),
        (4, "open_app", "explorer", 0),
    ];

    for (step_order, action_type, action_value, requires_permission) in steps {
        connection
            .execute(
                "INSERT INTO routine_proposal_steps (proposal_id, step_order, action_type, action_value, requires_permission) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    proposal_id,
                    step_order,
                    action_type,
                    action_value,
                    requires_permission
                ],
            )
            .map_err(|error| error.to_string())?;
    }

    let proposals = list_proposals(path)?;
    Ok(proposals.into_iter().find(|proposal| proposal.id == proposal_id))
}

pub fn update_proposal(path: &Path, proposal: ProposalUpdateInput) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;

    connection
        .execute(
            "UPDATE routine_proposals
             SET name = ?1, description = ?2, trigger_phrase = ?3
             WHERE id = ?4",
            params![
                proposal.name,
                proposal.description,
                proposal.trigger_phrase,
                proposal.id
            ],
        )
        .map_err(|error| error.to_string())?;

    update_proposal_steps(&connection, proposal.id, &proposal.steps)?;

    Ok(())
}

fn update_proposal_steps(
    connection: &Connection,
    proposal_id: i64,
    steps: &[ProposalStepInput],
) -> Result<(), String> {
    for step in steps {
        connection
            .execute(
                "UPDATE routine_proposal_steps
                 SET step_order = ?1, action_type = ?2, action_value = ?3, requires_permission = ?4
                 WHERE id = ?5 AND proposal_id = ?6",
                params![
                    step.step_order,
                    step.action_type,
                    step.action_value,
                    if step.requires_permission { 1 } else { 0 },
                    step.id,
                    proposal_id
                ],
            )
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

pub fn approve_proposal(path: &Path, proposal_id: i64) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;

    let proposal = connection
        .query_row(
            "SELECT name, description, trigger_phrase
             FROM routine_proposals
             WHERE id = ?1",
            params![proposal_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .map_err(|error| error.to_string())?;

    connection
        .execute(
            "INSERT INTO routines (name, description, trigger_phrase) VALUES (?1, ?2, ?3)",
            params![proposal.0, proposal.1, proposal.2],
        )
        .map_err(|error| error.to_string())?;

    let routine_id = connection.last_insert_rowid();
    let mut step_statement = connection
        .prepare(
            "SELECT step_order, action_type, action_value, requires_permission
             FROM routine_proposal_steps
             WHERE proposal_id = ?1
             ORDER BY step_order ASC",
        )
        .map_err(|error| error.to_string())?;

    let steps = step_statement
        .query_map(params![proposal_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    for (step_order, action_type, action_value, requires_permission) in steps {
        connection
            .execute(
                "INSERT INTO routine_steps (routine_id, step_order, action_type, action_value, requires_permission) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    routine_id,
                    step_order,
                    action_type,
                    action_value,
                    requires_permission
                ],
            )
            .map_err(|error| error.to_string())?;
    }

    connection
        .execute(
            "UPDATE routine_proposals
             SET status = ?1, reviewed_at = CURRENT_TIMESTAMP
             WHERE id = ?2",
            params!["approved", proposal_id],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn reject_proposal(path: &Path, proposal_id: i64) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE routine_proposals
             SET status = ?1, reviewed_at = CURRENT_TIMESTAMP
             WHERE id = ?2",
            params!["rejected", proposal_id],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn list_voice_corrections(path: &Path) -> Result<Vec<VoiceCorrectionRecord>, String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT id, heard_phrase, corrected_phrase, created_at
             FROM voice_corrections
             ORDER BY id DESC",
        )
        .map_err(|error| error.to_string())?;

    let corrections = statement
        .query_map([], |row| {
            Ok(VoiceCorrectionRecord {
                id: row.get(0)?,
                heard_phrase: row.get(1)?,
                corrected_phrase: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(corrections)
}

pub fn save_voice_correction(
    path: &Path,
    heard_phrase: &str,
    corrected_phrase: &str,
) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO voice_corrections (heard_phrase, corrected_phrase)
             VALUES (?1, ?2)
             ON CONFLICT(heard_phrase)
             DO UPDATE SET corrected_phrase = excluded.corrected_phrase",
            params![heard_phrase, corrected_phrase],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn get_local_voice_backend_config(
    path: &Path,
) -> Result<(Option<String>, Option<String>), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let result = connection
        .query_row(
            "SELECT executable_path, model_path
             FROM local_voice_backend_config
             WHERE id = 1",
            [],
            |row| Ok((row.get::<_, Option<String>>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .ok()
        .unwrap_or((None, None));

    Ok(result)
}

pub fn save_local_voice_backend_config(
    path: &Path,
    executable_path: Option<&str>,
    model_path: Option<&str>,
) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO local_voice_backend_config (id, executable_path, model_path)
             VALUES (1, ?1, ?2)
             ON CONFLICT(id)
             DO UPDATE SET executable_path = excluded.executable_path, model_path = excluded.model_path",
            params![executable_path, model_path],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn get_local_tts_backend_config(
    path: &Path,
) -> Result<(Option<String>, Option<String>), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let result = connection
        .query_row(
            "SELECT executable_path, model_path
             FROM local_tts_backend_config
             WHERE id = 1",
            [],
            |row| Ok((row.get::<_, Option<String>>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .ok()
        .unwrap_or((None, None));

    Ok(result)
}

pub fn save_local_tts_backend_config(
    path: &Path,
    executable_path: Option<&str>,
    model_path: Option<&str>,
) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO local_tts_backend_config (id, executable_path, model_path)
             VALUES (1, ?1, ?2)
             ON CONFLICT(id)
             DO UPDATE SET executable_path = excluded.executable_path, model_path = excluded.model_path",
            params![executable_path, model_path],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn get_wake_mode_config(path: &Path) -> Result<(String, bool), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let result = connection
        .query_row(
            "SELECT assistant_name, wake_mode_enabled
             FROM wake_mode_config
             WHERE id = 1",
            [],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)? == 1)),
        )
        .ok()
        .unwrap_or(("Jarvis".to_string(), false));

    Ok(result)
}

pub fn save_wake_mode_config(
    path: &Path,
    assistant_name: &str,
    wake_mode_enabled: bool,
) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO wake_mode_config (id, assistant_name, wake_mode_enabled)
             VALUES (1, ?1, ?2)
             ON CONFLICT(id)
             DO UPDATE SET assistant_name = excluded.assistant_name, wake_mode_enabled = excluded.wake_mode_enabled",
            params![assistant_name, if wake_mode_enabled { 1 } else { 0 }],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn list_browser_aliases(path: &Path) -> Result<Vec<BrowserAliasRecord>, String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT id, phrase, url, created_at
             FROM browser_aliases
             ORDER BY id DESC",
        )
        .map_err(|error| error.to_string())?;

    let aliases = statement
        .query_map([], |row| {
            Ok(BrowserAliasRecord {
                id: row.get(0)?,
                phrase: row.get(1)?,
                url: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(aliases)
}

pub fn save_browser_alias(path: &Path, phrase: &str, url: &str) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO browser_aliases (phrase, url)
             VALUES (?1, ?2)
             ON CONFLICT(phrase)
             DO UPDATE SET url = excluded.url",
            params![phrase, url],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn list_learned_intents(path: &Path) -> Result<Vec<LearnedIntentRecord>, String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT id, phrase, normalized_phrase, intent_kind, intent_payload, use_count, created_at, updated_at
             FROM learned_intents
             ORDER BY use_count DESC, updated_at DESC",
        )
        .map_err(|error| error.to_string())?;

    let mappings = statement
        .query_map([], |row| {
            Ok(LearnedIntentRecord {
                id: row.get(0)?,
                phrase: row.get(1)?,
                normalized_phrase: row.get(2)?,
                intent_kind: row.get(3)?,
                intent_payload: row.get(4)?,
                use_count: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(mappings)
}

pub fn save_learned_intent(
    path: &Path,
    phrase: &str,
    normalized_phrase: &str,
    intent_kind: &str,
    intent_payload: &str,
) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO learned_intents (phrase, normalized_phrase, intent_kind, intent_payload)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(normalized_phrase)
             DO UPDATE SET
                phrase = excluded.phrase,
                intent_kind = excluded.intent_kind,
                intent_payload = excluded.intent_payload,
                use_count = learned_intents.use_count + 1,
                updated_at = CURRENT_TIMESTAMP",
            params![phrase, normalized_phrase, intent_kind, intent_payload],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn get_notion_config(path: &Path) -> Result<(Option<String>, Option<String>), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .query_row(
            "SELECT access_token, database_id FROM notion_config WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .or_else(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => Ok((None, None)),
            other => Err(other),
        })
        .map_err(|error| error.to_string())
}

pub fn save_notion_config(
    path: &Path,
    access_token: Option<&str>,
    database_id: Option<&str>,
) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO notion_config (id, access_token, database_id)
             VALUES (1, ?1, ?2)
             ON CONFLICT(id) DO UPDATE SET
                access_token = COALESCE(excluded.access_token, notion_config.access_token),
                database_id = COALESCE(excluded.database_id, notion_config.database_id)",
            params![access_token, database_id],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn get_google_calendar_config(path: &Path) -> Result<(Option<String>, Option<String>), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .query_row(
            "SELECT client_id, api_key FROM google_calendar_config WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .or_else(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => Ok((None, None)),
            other => Err(other),
        })
        .map_err(|error| error.to_string())
}

pub fn save_google_calendar_config(
    path: &Path,
    client_id: Option<&str>,
    api_key: Option<&str>,
) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO google_calendar_config (id, client_id, api_key)
             VALUES (1, ?1, ?2)
             ON CONFLICT(id) DO UPDATE SET
                client_id = COALESCE(excluded.client_id, google_calendar_config.client_id),
                api_key = COALESCE(excluded.api_key, google_calendar_config.api_key)",
            params![client_id, api_key],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn get_spotify_config(path: &Path) -> Result<Option<String>, String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .query_row(
            "SELECT client_id FROM spotify_config WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .or_else(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => Ok(None),
            other => Err(other),
        })
        .map_err(|error| error.to_string())
}

pub fn save_spotify_config(path: &Path, client_id: Option<&str>) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO spotify_config (id, client_id)
             VALUES (1, ?1)
             ON CONFLICT(id) DO UPDATE SET
                client_id = COALESCE(excluded.client_id, spotify_config.client_id)",
            params![client_id],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn get_ollama_config(path: &Path) -> Result<(Option<String>, Option<String>), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let result = connection
        .query_row(
            "SELECT base_url, model_name
             FROM ollama_config
             WHERE id = 1",
            [],
            |row| Ok((row.get::<_, Option<String>>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .ok()
        .unwrap_or((None, None));

    Ok(result)
}

pub fn save_ollama_config(
    path: &Path,
    base_url: Option<&str>,
    model_name: Option<&str>,
) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO ollama_config (id, base_url, model_name)
             VALUES (1, ?1, ?2)
             ON CONFLICT(id)
             DO UPDATE SET base_url = excluded.base_url, model_name = excluded.model_name",
            params![base_url, model_name],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn get_executor_config(path: &Path) -> Result<(Option<String>, Option<String>), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    let result = connection
        .query_row(
            "SELECT command_path, working_directory
             FROM executor_config
             WHERE id = 1",
            [],
            |row| Ok((row.get::<_, Option<String>>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .ok()
        .unwrap_or((None, None));

    Ok(result)
}

pub fn save_executor_config(
    path: &Path,
    command_path: Option<&str>,
    working_directory: Option<&str>,
) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO executor_config (id, command_path, working_directory)
             VALUES (1, ?1, ?2)
             ON CONFLICT(id)
             DO UPDATE SET command_path = excluded.command_path, working_directory = excluded.working_directory",
            params![command_path, working_directory],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}
