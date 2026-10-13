package br.com.xiquimvargas.seller

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject

class LocalDb(ctx: Context): SQLiteOpenHelper(ctx, "xv_seller_offline.db", null, 2) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE clients(id TEXT PRIMARY KEY,json TEXT NOT NULL)")
        db.execSQL("CREATE TABLE products(id TEXT PRIMARY KEY,json TEXT NOT NULL)")
        db.execSQL("CREATE TABLE orders(id TEXT PRIMARY KEY,json TEXT NOT NULL)")
        db.execSQL("CREATE TABLE outbox(id TEXT PRIMARY KEY,type TEXT NOT NULL,payload TEXT NOT NULL,created_at INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'PENDING',error TEXT)")
        db.execSQL("CREATE TABLE meta(\"key\" TEXT PRIMARY KEY,value TEXT)")
    }
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {}
    fun replace(table:String, items:List<JSONObject>) { writableDatabase.beginTransaction(); try { writableDatabase.execSQL("DELETE FROM $table"); for (x in items) writableDatabase.insertOrThrow(table,null,ContentValues().apply{put("id",x.optString("id"));put("json",x.toString())}); writableDatabase.setTransactionSuccessful() } finally { writableDatabase.endTransaction() } }
    fun all(table:String):List<JSONObject> = readableDatabase.rawQuery("SELECT json FROM $table",null).use { c -> buildList { while(c.moveToNext()) add(JSONObject(c.getString(0))) } }
    fun put(table:String,x:JSONObject) { writableDatabase.insertWithOnConflict(table,null,ContentValues().apply{put("id",x.getString("id"));put("json",x.toString())},SQLiteDatabase.CONFLICT_REPLACE) }
    fun get(table:String,id:String):JSONObject? = readableDatabase.rawQuery("SELECT json FROM $table WHERE id=?",arrayOf(id)).use{if(it.moveToFirst()) JSONObject(it.getString(0)) else null}
    fun enqueue(type:String,payload:JSONObject,id:String){writableDatabase.insertOrThrow("outbox",null,ContentValues().apply{put("id",id);put("type",type);put("payload",payload.toString());put("created_at",System.currentTimeMillis());put("status","PENDING")})}
    fun pending():List<JSONObject> = readableDatabase.rawQuery("SELECT id,type,payload FROM outbox WHERE status='PENDING' ORDER BY created_at,id",null).use{c->buildList{while(c.moveToNext())add(JSONObject().put("id",c.getString(0)).put("type",c.getString(1)).put("payload",JSONObject(c.getString(2))))}}
    fun done(id:String){writableDatabase.delete("outbox","id=?",arrayOf(id))}
    fun fail(id:String,error:String){writableDatabase.execSQL("UPDATE outbox SET status='ERROR',error=? WHERE id=?",arrayOf(error.take(500),id))}
    fun retryErrors(){writableDatabase.execSQL("UPDATE outbox SET status='PENDING',error=NULL WHERE status='ERROR'")}
    fun pendingCount():Int=readableDatabase.rawQuery("SELECT COUNT(*) FROM outbox WHERE status<>'DONE'",null).use{it.moveToFirst();it.getInt(0)}
    fun putMeta(k:String,v:String){writableDatabase.insertWithOnConflict("meta",null,ContentValues().apply{put("key",k);put("value",v)},SQLiteDatabase.CONFLICT_REPLACE)}
    fun meta(k:String):String?=readableDatabase.rawQuery("SELECT value FROM meta WHERE \"key\"=?",arrayOf(k)).use{if(it.moveToFirst())it.getString(0)else null}
}
