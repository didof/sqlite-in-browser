import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import * as Comlink from "comlink";

export interface Task {
    id: number;
    text: string;
}

export class Database {
    private db: any = null;

    async initDb() {
        const sqlite3 = await sqlite3InitModule();

        console.log("Running SQLite3 version", sqlite3.version.libVersion);

        if (!(sqlite3 as any).opfs) {
            throw new Error(
                "OPFS is not available in this environment. Ensure the page is served with COOP/COEP headers."
            );
        }

        this.db = new sqlite3.oo1.OpfsDb("/mydb.sqlite3");
        console.log(
            "OPFS is available, created persisted database at",
            this.db.filename
        );

        this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT    NOT NULL
      )
    `);
        console.log('Table "tasks" initialized.');
    }

    query(sql: string, params: any[] = []): any[] {
        if (!this.db) throw new Error("Database not initialized");
        const results: any[] = [];
        this.db.exec({
            sql,
            bind: params,
            rowMode: "object",
            callback: (row: any) => results.push(row),
        });
        return results;
    }

    // ── Create ───────────────────────────────────────────────────────────────
    insertTask(text: string): void {
        if (!this.db) throw new Error("Database not initialized");
        this.db.exec({ sql: "INSERT INTO tasks (text) VALUES (?)", bind: [text] });
    }

    // ── Read ─────────────────────────────────────────────────────────────────
    getTasks(): Task[] {
        return this.query("SELECT * FROM tasks ORDER BY id DESC") as Task[];
    }

    getTask(id: number): Task | null {
        const rows = this.query("SELECT * FROM tasks WHERE id = ?", [id]) as Task[];
        return rows[0] ?? null;
    }

    // ── Update ────────────────────────────────────────────────────────────────
    updateTask(id: number, text: string): void {
        if (!this.db) throw new Error("Database not initialized");
        this.db.exec({
            sql: "UPDATE tasks SET text = ? WHERE id = ?",
            bind: [text, id],
        });
    }

    // ── Delete ────────────────────────────────────────────────────────────────
    deleteTask(id: number): void {
        if (!this.db) throw new Error("Database not initialized");
        this.db.exec({ sql: "DELETE FROM tasks WHERE id = ?", bind: [id] });
    }
}

Comlink.expose(new Database());
