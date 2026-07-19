mod persistence;

use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "phase5_local_persistence",
        sql: include_str!("../migrations/0001_phase5.sql"),
        kind: MigrationKind::Up,
    }];
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:slaides.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            persistence::save_project_atomic,
            persistence::write_recovery,
            persistence::open_project,
            persistence::inspect_recovery,
            persistence::discard_recovery,
            persistence::stage_asset,
            persistence::read_asset,
            persistence::discard_staged_assets
        ])
        .run(tauri::generate_context!())
        .expect("error while running SlAIdes");
}
