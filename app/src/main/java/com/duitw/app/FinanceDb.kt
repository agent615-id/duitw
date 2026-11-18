package com.duitw.app

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.format.DateTimeFormatter

data class Account(val id: Long, val name: String, val kind: String, val balance: Long)
data class Category(val id: Long, val name: String, val type: String)
data class Tx(val id: Long, val date: String, val type: String, val amount: Long, val category: String, val note: String, val fromId: Long, val toId: Long, val debtId: Long)
data class Debt(val id: Long, val kind: String, val person: String, val amount: Long, val paid: Long, val date: String, val note: String)
data class DebtPayment(val id: Long, val debtId: Long, val date: String, val amount: Long, val accountId: Long, val note: String)

class FinanceDb(context: Context) : SQLiteOpenHelper(context, "duitw.db", null, 3) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE accounts(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, kind TEXT NOT NULL DEFAULT 'Lainnya', balance INTEGER NOT NULL DEFAULT 0)")
        db.execSQL("CREATE TABLE transactions(id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, type TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0), category TEXT NOT NULL, note TEXT DEFAULT '', from_id INTEGER NOT NULL DEFAULT 0, to_id INTEGER NOT NULL DEFAULT 0, debt_id INTEGER NOT NULL DEFAULT 0)")
        db.execSQL("CREATE TABLE categories(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, UNIQUE(name,type))")
        db.execSQL("CREATE TABLE debts(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, person TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0), date TEXT NOT NULL, note TEXT DEFAULT '')")
        db.execSQL("CREATE TABLE debt_payments(id INTEGER PRIMARY KEY AUTOINCREMENT, debt_id INTEGER NOT NULL, date TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0), account_id INTEGER NOT NULL, note TEXT DEFAULT '')")
        db.execSQL("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        db.execSQL("INSERT INTO accounts(name,kind,balance) VALUES('Tunai','Tunai',0)")
        seedCategories(db)
    }
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            db.execSQL("ALTER TABLE accounts ADD COLUMN kind TEXT NOT NULL DEFAULT 'Lainnya'")
            db.execSQL("CREATE TABLE categories(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, UNIQUE(name,type))")
            db.execSQL("CREATE TABLE debts(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, person TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0), date TEXT NOT NULL, note TEXT DEFAULT '')")
            db.execSQL("CREATE TABLE debt_payments(id INTEGER PRIMARY KEY AUTOINCREMENT, debt_id INTEGER NOT NULL, date TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0), account_id INTEGER NOT NULL, note TEXT DEFAULT '')")
            db.execSQL("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT NOT NULL)")
            seedCategories(db)
        }
        if (oldVersion < 3) {
            try { db.execSQL("ALTER TABLE transactions ADD COLUMN debt_id INTEGER NOT NULL DEFAULT 0") } catch (_: Exception) {}
        }
        recomputeBalances(db)
    }

    private fun seedCategories(db: SQLiteDatabase) {
        val items = listOf(
            "Gaji" to "income","Bonus" to "income","Hadiah" to "income","Lainnya" to "income",
            "Makanan" to "expense","Transportasi" to "expense","Belanja" to "expense","Tagihan" to "expense",
            "Hiburan" to "expense","Kesehatan" to "expense","Pendidikan" to "expense","Lainnya" to "expense"
        )
        items.forEach { (n,t) -> db.insertWithOnConflict("categories", null, ContentValues().apply { put("name",n); put("type",t) }, SQLiteDatabase.CONFLICT_IGNORE) }
    }

    fun accounts(): List<Account> = readableDatabase.rawQuery("SELECT id,name,kind,balance FROM accounts ORDER BY id",null).use { c ->
        buildList { while(c.moveToNext()) add(Account(c.getLong(0),c.getString(1),c.getString(2),c.getLong(3))) }
    }
    fun addAccount(name:String, kind:String, opening:Long=0) {
        require(name.trim().isNotEmpty()) {"Nama rekening wajib diisi"}
        require(opening >= 0) {"Saldo awal tidak valid"}
        val d=writableDatabase; d.beginTransaction()
        try {
            val id=d.insertOrThrow("accounts",null,ContentValues().apply{put("name",name.trim());put("kind",kind);put("balance",0)})
            if(opening>0) d.insertOrThrow("transactions",null,ContentValues().apply{
                put("date",LocalDate.now().toString());put("type","opening");put("amount",opening);put("category","Saldo awal");put("note","");put("from_id",0);put("to_id",id);put("debt_id",0)
            })
            recomputeBalances(d); d.setTransactionSuccessful()
        } finally { d.endTransaction() }
    }
    fun updateAccount(id:Long,name:String,kind:String) {
        require(name.trim().isNotEmpty()) {"Nama rekening wajib diisi"}
        writableDatabase.update("accounts",ContentValues().apply{put("name",name.trim());put("kind",kind)},"id=?",arrayOf(id.toString()))
    }
    fun deleteAccount(id:Long) {
        require(accounts().size>1) {"Minimal satu rekening harus tersedia"}
        val d=writableDatabase
        val used=d.rawQuery("SELECT COUNT(*) FROM transactions WHERE (from_id=? OR to_id=?) AND type!='opening'",arrayOf(id.toString(),id.toString())).use{it.moveToFirst();it.getLong(0)}
        val payments=d.rawQuery("SELECT COUNT(*) FROM debt_payments WHERE account_id=?",arrayOf(id.toString())).use{it.moveToFirst();it.getLong(0)}
        require(used==0L && payments==0L) {"Rekening sudah dipakai transaksi dan tidak dapat dihapus"}
        d.beginTransaction();try{d.delete("transactions","type='opening' AND to_id=?",arrayOf(id.toString()));d.delete("accounts","id=?",arrayOf(id.toString()));recomputeBalances(d);d.setTransactionSuccessful()}finally{d.endTransaction()}
    }

    fun categories(type:String):List<Category> = readableDatabase.rawQuery("SELECT id,name,type FROM categories WHERE type=? ORDER BY name",arrayOf(type)).use{c->
        buildList{while(c.moveToNext())add(Category(c.getLong(0),c.getString(1),c.getString(2)))}
    }
    fun addCategory(name:String,type:String){require(name.trim().isNotEmpty()){"Nama kategori wajib diisi"};writableDatabase.insertOrThrow("categories",null,ContentValues().apply{put("name",name.trim());put("type",type)})}
    fun updateCategory(id:Long,name:String){require(name.trim().isNotEmpty()){"Nama kategori wajib diisi"};writableDatabase.update("categories",ContentValues().apply{put("name",name.trim())},"id=?",arrayOf(id.toString()))}
    fun deleteCategory(id:Long){writableDatabase.delete("categories","id=?",arrayOf(id.toString()))}

    fun addTransaction(type:String,amount:Long,category:String,note:String,fromId:Long,toId:Long,date:String,debtId:Long=0) {
        validateAmountDate(amount,date)
        require(type in setOf("income","expense","transfer")) {"Jenis transaksi tidak valid"}
        if(type=="income") require(toId>0) {"Rekening tujuan wajib dipilih"}
        if(type=="expense") require(fromId>0) {"Rekening asal wajib dipilih"}
        if(type=="transfer") require(fromId>0 && toId>0 && fromId!=toId) {"Rekening asal dan tujuan harus berbeda"}
        val d=writableDatabase; d.beginTransaction()
        try {
            d.insertOrThrow("transactions",null,ContentValues().apply{put("date",date);put("type",type);put("amount",amount);put("category",category.ifBlank{"Lainnya"});put("note",note);put("from_id",fromId);put("to_id",toId);put("debt_id",debtId)})
            recomputeBalances(d); d.setTransactionSuccessful()
        } finally { d.endTransaction() }
    }
    fun updateTransaction(id:Long,type:String,amount:Long,category:String,note:String,fromId:Long,toId:Long,date:String,debtId:Long=0){
        validateAmountDate(amount,date)
        val d=writableDatabase;d.beginTransaction()
        try{
            d.update("transactions",ContentValues().apply{put("date",date);put("type",type);put("amount",amount);put("category",category);put("note",note);put("from_id",fromId);put("to_id",toId);put("debt_id",debtId)},"id=?",arrayOf(id.toString()))
            recomputeBalances(d);d.setTransactionSuccessful()
        }finally{d.endTransaction()}
    }
    fun deleteTransaction(id:Long){val d=writableDatabase;d.beginTransaction();try{d.delete("transactions","id=?",arrayOf(id.toString()));recomputeBalances(d);d.setTransactionSuccessful()}finally{d.endTransaction()}}

    fun transactions(limit:Int=500,search:String="",type:String="",fromDate:String="",toDate:String="",category:String="",accountId:Long=0):List<Tx>{
        val args=mutableListOf<String>();val w=mutableListOf<String>()
        if(search.isNotBlank()){w.add("(t.note LIKE ? OR t.category LIKE ?)");args.add("%$search%");args.add("%$search%")}
        if(type.isNotBlank()){w.add("t.type=?");args.add(type)}
        if(fromDate.isNotBlank()){w.add("t.date>=?");args.add(fromDate)}
        if(toDate.isNotBlank()){w.add("t.date<=?");args.add(toDate)}
        if(category.isNotBlank()){w.add("t.category=?");args.add(category)}
        if(accountId>0){w.add("(t.from_id=? OR t.to_id=?)");args.add(accountId.toString());args.add(accountId.toString())}
        val sql="SELECT t.id,t.date,t.type,t.amount,t.category,COALESCE(t.note,''),t.from_id,t.to_id,t.debt_id FROM transactions t"+if(w.isEmpty())"" else " WHERE "+w.joinToString(" AND ")+" ORDER BY t.date DESC,t.id DESC LIMIT ?"
        args.add(limit.toString())
        return readableDatabase.rawQuery(sql,args.toTypedArray()).use{c->buildList{while(c.moveToNext())add(Tx(c.getLong(0),c.getString(1),c.getString(2),c.getLong(3),c.getString(4),c.getString(5),c.getLong(6),c.getLong(7),c.getLong(8)))}}
    }
    fun totalBalance()=accounts().sumOf{it.balance}
    fun recomputeBalances()=recomputeBalances(writableDatabase)
    private fun recomputeBalances(d:SQLiteDatabase){
        d.execSQL("UPDATE accounts SET balance=0")
        d.rawQuery("SELECT type,amount,from_id,to_id FROM transactions ORDER BY id",null).use{c->while(c.moveToNext()){
            val type=c.getString(0);val a=c.getLong(1);val f=c.getLong(2);val t=c.getLong(3)
            if(type=="income"||type=="opening") d.execSQL("UPDATE accounts SET balance=balance+? WHERE id=?",arrayOf(a,t))
            if(type=="expense") d.execSQL("UPDATE accounts SET balance=balance-? WHERE id=?",arrayOf(a,f))
            if(type=="transfer"){d.execSQL("UPDATE accounts SET balance=balance-? WHERE id=?",arrayOf(a,f));d.execSQL("UPDATE accounts SET balance=balance+? WHERE id=?",arrayOf(a,t))}
        }}
    }

    fun debts(kind:String=""):List<Debt>{
        val w=if(kind.isBlank())"" else " WHERE d.kind=?"
        return readableDatabase.rawQuery("SELECT d.id,d.kind,d.person,d.amount,COALESCE(SUM(p.amount),0),d.date,COALESCE(d.note,'') FROM debts d LEFT JOIN debt_payments p ON p.debt_id=d.id$w GROUP BY d.id ORDER BY d.date DESC,d.id DESC",if(kind.isBlank())null else arrayOf(kind)).use{c->buildList{while(c.moveToNext())add(Debt(c.getLong(0),c.getString(1),c.getString(2),c.getLong(3),c.getLong(4),c.getString(5),c.getString(6)))}}
    }
    fun addDebt(kind:String,person:String,amount:Long,date:String,note:String){validateAmountDate(amount,date);require(person.trim().isNotEmpty()){"Nama pihak wajib diisi"};writableDatabase.insertOrThrow("debts",null,ContentValues().apply{put("kind",kind);put("person",person.trim());put("amount",amount);put("date",date);put("note",note)})}
    fun deleteDebt(id:Long){require(debtPayments(id).isEmpty()){"Hapus riwayat pembayaran terlebih dahulu"};writableDatabase.delete("debts","id=?",arrayOf(id.toString()))}
    fun debtPayments(id:Long):List<DebtPayment>=readableDatabase.rawQuery("SELECT id,debt_id,date,amount,account_id,COALESCE(note,'') FROM debt_payments WHERE debt_id=? ORDER BY date DESC,id DESC",arrayOf(id.toString())).use{c->buildList{while(c.moveToNext())add(DebtPayment(c.getLong(0),c.getLong(1),c.getString(2),c.getLong(3),c.getLong(4),c.getString(5)))}}
    fun addDebtPayment(debtId:Long,amount:Long,accountId:Long,date:String,note:String){
        validateAmountDate(amount,date);val debt=debts().firstOrNull{it.id==debtId}?:error("Data tidak ditemukan");require(debt.remaining()>=amount){"Pembayaran melebihi sisa kewajiban/piutang"};require(accountId>0){"Rekening wajib dipilih"}
        val d=writableDatabase;d.beginTransaction();try{
            d.insertOrThrow("debt_payments",null,ContentValues().apply{put("debt_id",debtId);put("amount",amount);put("account_id",accountId);put("date",date);put("note",note)})
            val type=if(debt.kind=="receivable")"income" else "expense"
            d.insertOrThrow("transactions",null,ContentValues().apply{put("date",date);put("type",type);put("amount",amount);put("category",if(type=="income")"Pelunasan piutang" else "Pembayaran kewajiban");put("note",note);put("from_id",if(type=="expense")accountId else 0);put("to_id",if(type=="income")accountId else 0);put("debt_id",debtId)})
            recomputeBalances(d);d.setTransactionSuccessful()
        }finally{d.endTransaction()}
    }
    private fun Debt.remaining()=amount-paid

    fun setting(key:String,default:String=""):String=readableDatabase.rawQuery("SELECT value FROM settings WHERE key=?",arrayOf(key)).use{if(it.moveToFirst())it.getString(0)else default}
    fun setSetting(key:String,value:String){writableDatabase.insertWithOnConflict("settings",ContentValues().apply{put("key",key);put("value",value)},SQLiteDatabase.CONFLICT_REPLACE)}

    fun exportJson():String{
        val root=JSONObject().put("app","duitw").put("version",3)
        root.put("accounts",JSONArray().also{a->accounts().forEach{x->a.put(JSONObject().put("id",x.id).put("name",x.name).put("kind",x.kind))}})
        root.put("categories",JSONArray().also{a->categories("income").plus(categories("expense")).forEach{x->a.put(JSONObject().put("id",x.id).put("name",x.name).put("type",x.type))}})
        root.put("transactions",JSONArray().also{a->transactions(100000).forEach{x->a.put(JSONObject().put("id",x.id).put("date",x.date).put("type",x.type).put("amount",x.amount).put("category",x.category).put("note",x.note).put("from_id",x.fromId).put("to_id",x.toId).put("debt_id",x.debtId))}})
        root.put("debts",JSONArray().also{a->debts().forEach{x->a.put(JSONObject().put("id",x.id).put("kind",x.kind).put("person",x.person).put("amount",x.amount).put("date",x.date).put("note",x.note))}})
        root.put("debt_payments",JSONArray().also{a->debts().forEach{d->debtPayments(d.id).forEach{x->a.put(JSONObject().put("id",x.id).put("debt_id",x.debtId).put("date",x.date).put("amount",x.amount).put("account_id",x.accountId).put("note",x.note))}}})
        root.put("settings",JSONObject().put("user_name",setting("user_name","")))
        return root.toString(2)
    }
    fun restoreJson(raw:String){
        val root=JSONObject(raw);require(root.optString("app")=="duitw"){"File backup bukan milik duitw"};require(root.has("accounts")&&root.has("transactions")){"Struktur backup tidak lengkap"}
        val d=writableDatabase;d.beginTransaction();try{
            listOf("debt_payments","debts","transactions","categories","accounts","settings").forEach{d.delete(it,null,null)}
            val ac=root.getJSONArray("accounts");for(i in 0 until ac.length()){val x=ac.getJSONObject(i);d.insertOrThrow("accounts",null,ContentValues().apply{put("id",x.optLong("id",0));put("name",x.getString("name"));put("kind",x.optString("kind","Lainnya"));put("balance",0)})}
            if(ac.length()==0) d.insertOrThrow("accounts",null,ContentValues().apply{put("name","Tunai");put("kind","Tunai");put("balance",0)})
            root.optJSONArray("categories")?.let{a->for(i in 0 until a.length()){val x=a.getJSONObject(i);d.insertWithOnConflict("categories",null,ContentValues().apply{put("id",x.optLong("id",0));put("name",x.getString("name"));put("type",x.getString("type"))},SQLiteDatabase.CONFLICT_IGNORE)}}
            if(d.rawQuery("SELECT COUNT(*) FROM categories",null).use{it.moveToFirst();it.getLong(0)}==0L)seedCategories(d)
            root.getJSONArray("transactions").let{a->for(i in 0 until a.length()){val x=a.getJSONObject(i);d.insertOrThrow("transactions",null,ContentValues().apply{put("id",x.optLong("id",0));put("date",x.getString("date"));put("type",x.getString("type"));put("amount",x.getLong("amount"));put("category",x.optString("category","Lainnya"));put("note",x.optString("note",""));put("from_id",x.optLong("from_id",0));put("to_id",x.optLong("to_id",0));put("debt_id",x.optLong("debt_id",0))})}}
            root.optJSONArray("debts")?.let{a->for(i in 0 until a.length()){val x=a.getJSONObject(i);d.insertOrThrow("debts",null,ContentValues().apply{put("id",x.optLong("id",0));put("kind",x.getString("kind"));put("person",x.getString("person"));put("amount",x.getLong("amount"));put("date",x.getString("date"));put("note",x.optString("note",""))})}}
            root.optJSONArray("debt_payments")?.let{a->for(i in 0 until a.length()){val x=a.getJSONObject(i);d.insertOrThrow("debt_payments",null,ContentValues().apply{put("id",x.optLong("id",0));put("debt_id",x.getLong("debt_id"));put("date",x.getString("date"));put("amount",x.getLong("amount"));put("account_id",x.getLong("account_id"));put("note",x.optString("note",""))})}}
            root.optJSONObject("settings")?.let{x->setSetting("user_name",x.optString("user_name",""))}
            recomputeBalances(d);d.setTransactionSuccessful()
        }finally{d.endTransaction()}
    }
    private fun validateAmountDate(amount:Long,date:String){require(amount>0){"Nominal harus lebih dari nol"};require(runCatching{LocalDate.parse(date,DateTimeFormatter.ISO_LOCAL_DATE)}.isSuccess){"Tanggal harus YYYY-MM-DD"}}
}
