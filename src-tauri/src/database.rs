use crate::models::{Favorite, HistoryEntry};
use rusqlite::{params, Connection};
use std::{path::Path, sync::Mutex};

pub struct Database(pub Mutex<Connection>);
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn progress_migration_and_episode_identity_roundtrip() {
        let db=Database::open(":memory:").unwrap();
        let mut entry:HistoryEntry=serde_json::from_value(serde_json::json!({"anime_id":"anilist:16498","anime_title":"Attack on Titan","provider":"addon:https://anime-kitsu.strem.fun|anime","season":1,"episode":3.0,"episode_title":"Episode three","language":"Legendado","quality":"2160p","timestamp":300,"completed":false})).unwrap();
        entry.duration=1200;entry.episode_id="kitsu:7442:3".into();entry.stream_key="stable-server-key".into();entry.cover_url="https://example.test/cover.jpg".into();
        db.save_progress(&entry).unwrap();
        let saved=db.progress(&entry.anime_id,&entry.provider,1,3.0).unwrap().unwrap();
        assert_eq!(saved.duration,1200);assert_eq!(saved.timestamp,300);assert_eq!(saved.episode_id,"kitsu:7442:3");assert_eq!(saved.stream_key,"stable-server-key");assert_eq!(saved.cover_url,entry.cover_url);
        entry.timestamp=420;db.save_progress(&entry).unwrap();assert_eq!(db.history(10).unwrap().len(),1);
        assert_eq!(db.progress(&entry.anime_id,&entry.provider,1,3.0).unwrap().unwrap().timestamp,420);
        assert!(db.progress(&entry.anime_id,"different-provider",1,3.0).unwrap().is_none());
    }
    fn entry(id:&str,season:i64,episode:f64)->HistoryEntry{serde_json::from_value(serde_json::json!({"anime_id":id,"anime_title":"Fixture","provider":"fixture","season":season,"episode":episode,"episode_title":"Episode","language":"Legendado","quality":"1080p","timestamp":300,"duration":1200,"completed":false})).unwrap()}
    #[test]
    fn history_edits_are_scoped_and_backup_import_is_atomic(){
        let db=Database::open(":memory:").unwrap();for e in [entry("one",1,1.0),entry("one",1,2.0),entry("one",2,1.0),entry("two",1,1.0)]{db.save_progress(&e).unwrap();}
        db.remove_progress("one","fixture",Some(1),Some(1.0)).unwrap();assert_eq!(db.anime_progress("one","fixture").unwrap().len(),2);assert_eq!(db.history(10).unwrap().len(),3);
        db.conn().unwrap().execute_batch("CREATE TRIGGER reject_broken BEFORE INSERT ON history WHEN NEW.anime_id='broken' BEGIN SELECT RAISE(ABORT,'fixture failure'); END;").unwrap();
        let favorite:Favorite=serde_json::from_value(serde_json::json!({"anime_id":"new","anime_title":"New","provider":"fixture"})).unwrap();
        assert!(db.import_user_data(&[entry("new",1,1.0),entry("broken",1,1.0)],&[favorite.clone()]).is_err());assert!(db.favorites().unwrap().is_empty());assert_eq!(db.history(10).unwrap().len(),3);
        db.import_user_data(&[entry("new",1,1.0)],&[favorite]).unwrap();assert_eq!(db.history(10).unwrap().len(),4);assert_eq!(db.favorites().unwrap().len(),1);
    }
    #[test]
    fn opening_legacy_database_preserves_existing_records(){
        let folder=std::env::temp_dir().join(format!("anibr-migration-{}",uuid::Uuid::new_v4()));std::fs::create_dir_all(&folder).unwrap();let path=folder.join("fixture.db");
        {let db=Database::open(path.to_str().unwrap()).unwrap();db.save_progress(&entry("preserved",1,1.0)).unwrap();db.conn().unwrap().execute("DELETE FROM app_meta WHERE key='clean_slate_v021'",[]).unwrap();}
        let db=Database::open(path.to_str().unwrap()).unwrap();assert_eq!(db.history(10).unwrap().len(),1);drop(db);std::fs::remove_dir_all(folder).unwrap();
    }
}
impl Database {
    pub fn open(path: &str) -> Result<Self, String> {
        if let Some(parent) = Path::new(path).parent().filter(|parent|!parent.as_os_str().is_empty()) {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let db = Connection::open(path).map_err(|e| e.to_string())?;
        db.execute_batch("PRAGMA journal_mode=WAL;
          CREATE TABLE IF NOT EXISTS favorites(id INTEGER PRIMARY KEY AUTOINCREMENT,anime_id TEXT NOT NULL,anime_title TEXT NOT NULL,provider TEXT NOT NULL,cover_url TEXT NOT NULL DEFAULT '',synopsis TEXT NOT NULL DEFAULT '',added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(anime_id,provider));
          CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY AUTOINCREMENT,anime_id TEXT NOT NULL,anime_title TEXT NOT NULL,provider TEXT NOT NULL,season INTEGER NOT NULL DEFAULT 1,episode REAL NOT NULL,episode_title TEXT NOT NULL DEFAULT '',language TEXT NOT NULL DEFAULT 'dublado',quality TEXT NOT NULL DEFAULT 'best',watched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,timestamp INTEGER NOT NULL DEFAULT 0,completed INTEGER NOT NULL DEFAULT 0);
          CREATE INDEX IF NOT EXISTS idx_history_anime ON history(anime_id,provider);
          CREATE TABLE IF NOT EXISTS recent_searches(id INTEGER PRIMARY KEY AUTOINCREMENT,query TEXT NOT NULL,provider TEXT NOT NULL,searched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(query,provider));")
          .map_err(|e| e.to_string())?;
        db.execute_batch("CREATE TABLE IF NOT EXISTS app_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);")
          .map_err(|e| e.to_string())?;
        let clean_applied: i64 = db.query_row("SELECT COUNT(*) FROM app_meta WHERE key='clean_slate_v021'", [], |r| r.get(0)).map_err(|e|e.to_string())?;
        if clean_applied == 0 {
            db.execute_batch("INSERT INTO app_meta(key,value) VALUES('clean_slate_v021','1');")
              .map_err(|e|e.to_string())?;
        }
        let columns: Vec<String> = {
            let mut stmt=db.prepare("PRAGMA table_info(history)").map_err(|e|e.to_string())?;
            let rows=stmt.query_map([],|r|r.get(1)).map_err(|e|e.to_string())?;
            rows.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?
        };
        for (name,definition) in [("duration","INTEGER NOT NULL DEFAULT 0"),("episode_id","TEXT NOT NULL DEFAULT ''"),("stream_key","TEXT NOT NULL DEFAULT ''"),("cover_url","TEXT NOT NULL DEFAULT ''"),("banner_url","TEXT NOT NULL DEFAULT ''")] {
            if !columns.iter().any(|column|column==name) {
                db.execute_batch(&format!("ALTER TABLE history ADD COLUMN {name} {definition};")).map_err(|e|e.to_string())?;
            }
        }
        Ok(Self(Mutex::new(db)))
    }
    fn conn(&self) -> Result<std::sync::MutexGuard<'_, Connection>, String> {
        self.0.lock().map_err(|_| "database lock poisoned".into())
    }
    pub fn favorites(&self) -> Result<Vec<Favorite>, String> {
        let db = self.conn()?;
        let mut s=db.prepare("SELECT id,anime_id,anime_title,provider,cover_url,synopsis,added_at FROM favorites ORDER BY added_at DESC").map_err(|e|e.to_string())?;
        let rows = s
            .query_map([], |r| {
                Ok(Favorite {
                    id: r.get(0)?,
                    anime_id: r.get(1)?,
                    anime_title: r.get(2)?,
                    provider: r.get(3)?,
                    cover_url: r.get(4)?,
                    synopsis: r.get(5)?,
                    added_at: r.get(6)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    }
    pub fn add_favorite(&self, f: &Favorite) -> Result<(), String> {
        self.conn()?.execute("INSERT INTO favorites(anime_id,anime_title,provider,cover_url,synopsis) VALUES(?1,?2,?3,?4,?5) ON CONFLICT(anime_id,provider) DO UPDATE SET anime_title=excluded.anime_title,cover_url=excluded.cover_url,synopsis=excluded.synopsis",params![f.anime_id,f.anime_title,f.provider,f.cover_url,f.synopsis]).map_err(|e|e.to_string())?;
        Ok(())
    }
    pub fn remove_favorite(&self, anime_id: &str, provider: &str) -> Result<(), String> {
        self.conn()?
            .execute(
                "DELETE FROM favorites WHERE anime_id=?1 AND provider=?2",
                params![anime_id, provider],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    fn history_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<HistoryEntry> {
        Ok(HistoryEntry {
            id:r.get(0)?,anime_id:r.get(1)?,anime_title:r.get(2)?,provider:r.get(3)?,
            season:r.get(4)?,episode:r.get(5)?,episode_title:r.get(6)?,language:r.get(7)?,
            quality:r.get(8)?,watched_at:r.get(9)?,timestamp:r.get(10)?,completed:r.get(11)?,
            duration:r.get(12)?,episode_id:r.get(13)?,stream_key:r.get(14)?,
            cover_url:r.get(15)?,banner_url:r.get(16)?,
        })
    }
    pub fn history(&self, limit: i64) -> Result<Vec<HistoryEntry>, String> {
        let db=self.conn()?;
        let mut s=db.prepare("SELECT id,anime_id,anime_title,provider,season,episode,episode_title,language,quality,watched_at,timestamp,completed,duration,episode_id,stream_key,cover_url,banner_url FROM history ORDER BY watched_at DESC,id DESC LIMIT ?1").map_err(|e|e.to_string())?;
        let rows=s.query_map([limit],Self::history_row).map_err(|e|e.to_string())?;
        rows.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())
    }
    pub fn add_history(&self, h: &HistoryEntry) -> Result<(), String> {
        self.save_progress(h)
    }
    pub fn save_progress(&self, h: &HistoryEntry) -> Result<(), String> {
        let mut db=self.conn()?;
        let tx=db.transaction().map_err(|e|e.to_string())?;
        tx.execute("DELETE FROM history WHERE anime_id=?1 AND provider=?2 AND season=?3 AND episode=?4",params![h.anime_id,h.provider,h.season,h.episode]).map_err(|e|e.to_string())?;
        tx.execute("INSERT INTO history(anime_id,anime_title,provider,season,episode,episode_title,language,quality,timestamp,completed,duration,episode_id,stream_key,cover_url,banner_url,watched_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,CURRENT_TIMESTAMP)",params![h.anime_id,h.anime_title,h.provider,h.season,h.episode,h.episode_title,h.language,h.quality,h.timestamp.max(0),h.completed,h.duration.max(0),h.episode_id,h.stream_key,h.cover_url,h.banner_url]).map_err(|e|e.to_string())?;
        tx.commit().map_err(|e|e.to_string())
    }
    pub fn progress(&self, anime_id: &str, provider: &str, season: i64, episode: f64) -> Result<Option<HistoryEntry>, String> {
        let db=self.conn()?;
        let mut s=db.prepare("SELECT id,anime_id,anime_title,provider,season,episode,episode_title,language,quality,watched_at,timestamp,completed,duration,episode_id,stream_key,cover_url,banner_url FROM history WHERE anime_id=?1 AND provider=?2 AND season=?3 AND episode=?4 ORDER BY watched_at DESC,id DESC LIMIT 1").map_err(|e|e.to_string())?;
        let mut rows=s.query(params![anime_id,provider,season,episode]).map_err(|e|e.to_string())?;
        rows.next().map_err(|e|e.to_string())?.map(Self::history_row).transpose().map_err(|e|e.to_string())
    }
    pub fn clear_history(&self) -> Result<(), String> {
        self.conn()?
            .execute("DELETE FROM history", [])
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    pub fn remove_progress(&self, anime_id:&str,provider:&str,season:Option<i64>,episode:Option<f64>)->Result<(),String>{
        self.conn()?.execute("DELETE FROM history WHERE anime_id=?1 AND provider=?2 AND (?3 IS NULL OR season=?3) AND (?4 IS NULL OR episode=?4)",params![anime_id,provider,season,episode]).map_err(|e|e.to_string())?;Ok(())
    }
    pub fn anime_progress(&self,anime_id:&str,provider:&str)->Result<Vec<HistoryEntry>,String>{
        let db=self.conn()?;let mut statement=db.prepare("SELECT id,anime_id,anime_title,provider,season,episode,episode_title,language,quality,watched_at,timestamp,completed,duration,episode_id,stream_key,cover_url,banner_url FROM history WHERE anime_id=?1 AND provider=?2 ORDER BY watched_at DESC,id DESC").map_err(|e|e.to_string())?;
        let rows=statement.query_map(params![anime_id,provider],Self::history_row).map_err(|e|e.to_string())?;rows.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())
    }
    pub fn import_user_data(&self,entries:&[HistoryEntry],favorites:&[Favorite])->Result<(),String>{
        let mut db=self.conn()?;let tx=db.transaction().map_err(|e|e.to_string())?;
        for f in favorites{tx.execute("INSERT INTO favorites(anime_id,anime_title,provider,cover_url,synopsis) VALUES(?1,?2,?3,?4,?5) ON CONFLICT(anime_id,provider) DO UPDATE SET anime_title=excluded.anime_title,cover_url=excluded.cover_url,synopsis=excluded.synopsis",params![f.anime_id,f.anime_title,f.provider,f.cover_url,f.synopsis]).map_err(|e|e.to_string())?;}
        for h in entries{
            tx.execute("DELETE FROM history WHERE anime_id=?1 AND provider=?2 AND season=?3 AND episode=?4",params![h.anime_id,h.provider,h.season,h.episode]).map_err(|e|e.to_string())?;
            tx.execute("INSERT INTO history(anime_id,anime_title,provider,season,episode,episode_title,language,quality,timestamp,completed,duration,episode_id,stream_key,cover_url,banner_url,watched_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,COALESCE(datetime(?16),CURRENT_TIMESTAMP))",params![h.anime_id,h.anime_title,h.provider,h.season,h.episode,h.episode_title,h.language,h.quality,h.timestamp,h.completed,h.duration,h.episode_id,h.stream_key,h.cover_url,h.banner_url,h.watched_at]).map_err(|e|e.to_string())?;
        }tx.commit().map_err(|e|e.to_string())
    }
    pub fn save_search(&self, q: &str, p: &str) -> Result<(), String> {
        self.conn()?.execute("INSERT INTO recent_searches(query,provider,searched_at) VALUES(?1,?2,CURRENT_TIMESTAMP) ON CONFLICT(query,provider) DO UPDATE SET searched_at=CURRENT_TIMESTAMP",params![q,p]).map_err(|e|e.to_string())?;
        Ok(())
    }
    pub fn searches(&self) -> Result<Vec<String>, String> {
        let db = self.conn()?;
        let mut s = db
            .prepare("SELECT query FROM recent_searches ORDER BY searched_at DESC LIMIT 20")
            .map_err(|e| e.to_string())?;
        let rows = s.query_map([], |r| r.get(0)).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    }
}
