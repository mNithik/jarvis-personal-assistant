use std::path::Path;

use rusqlite::{params, Connection};

use crate::models::DayPlanRecord;

pub fn ensure_day_plans_table(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS day_plans (
            plan_date TEXT PRIMARY KEY,
            top_three_json TEXT NOT NULL,
            full_plan_text TEXT NOT NULL,
            notion_page_id TEXT,
            suggested_actions_json TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ",
    )
    .map_err(|error| error.to_string())
}

pub fn upsert_day_plan(db_path: &Path, record: &DayPlanRecord) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    ensure_day_plans_table(&conn)?;
    let top_three_json =
        serde_json::to_string(&record.top_three).map_err(|error| error.to_string())?;
    let suggested_actions_json =
        serde_json::to_string(&record.suggested_actions).map_err(|error| error.to_string())?;
    conn.execute(
        "
        INSERT INTO day_plans (
            plan_date, top_three_json, full_plan_text, notion_page_id,
            suggested_actions_json, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        ON CONFLICT(plan_date) DO UPDATE SET
            top_three_json = excluded.top_three_json,
            full_plan_text = excluded.full_plan_text,
            notion_page_id = COALESCE(excluded.notion_page_id, day_plans.notion_page_id),
            suggested_actions_json = excluded.suggested_actions_json,
            updated_at = excluded.updated_at
        ",
        params![
            record.plan_date,
            top_three_json,
            record.full_plan_text,
            record.notion_page_id,
            suggested_actions_json,
            record.created_at,
            record.updated_at,
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn get_day_plan(db_path: &Path, plan_date: &str) -> Result<Option<DayPlanRecord>, String> {
    let conn = Connection::open(db_path).map_err(|error| error.to_string())?;
    ensure_day_plans_table(&conn)?;
    let mut statement = conn
        .prepare(
            "
            SELECT plan_date, top_three_json, full_plan_text, notion_page_id,
                   suggested_actions_json, created_at, updated_at
            FROM day_plans
            WHERE plan_date = ?1
            ",
        )
        .map_err(|error| error.to_string())?;
    let mut rows = statement
        .query_map([plan_date], |row| {
            let top_three_json: String = row.get(1)?;
            let suggested_actions_json: String = row.get(4)?;
            Ok(DayPlanRecord {
                plan_date: row.get(0)?,
                top_three: serde_json::from_str(&top_three_json).unwrap_or_default(),
                full_plan_text: row.get(2)?,
                notion_page_id: row.get(3)?,
                suggested_actions: serde_json::from_str(&suggested_actions_json)
                    .unwrap_or_default(),
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|error| error.to_string())?;
    Ok(rows.next().transpose().map_err(|error| error.to_string())?)
}
