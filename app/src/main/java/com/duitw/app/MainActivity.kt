package com.duitw.app

import android.app.*
import android.content.*
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.text.InputType
import android.view.*
import android.widget.*
import java.text.NumberFormat
import java.time.LocalDate
import java.time.YearMonth
import java.util.Locale

class MainActivity : Activity() {
    private lateinit var db: FinanceDb
    private lateinit var content: LinearLayout
    private val bg=Color.rgb(10,15,24); private val panel=Color.rgb(20,29,43); private val panel2=Color.rgb(28,39,56)
    private val white=Color.rgb(240,244,248); private val muted=Color.rgb(150,164,183)
    private val green=Color.rgb(52,211,153); private val red=Color.rgb(251,113,133); private val accent=Color.rgb(92,142,255); private val yellow=Color.rgb(250,204,21)
    private val money=NumberFormat.getCurrencyInstance(Locale("id","ID")).apply{maximumFractionDigits=0;currency=java.util.Currency.getInstance("IDR")}
    private val date=LocalDate.now().toString()
    private val navLabels=arrayOf("Beranda","Transaksi","Laporan","Pengaturan")
    private var selectedNav=0
    private val exportCode=701
    private val importCode=702

    override fun onCreate(b:Bundle?){super.onCreate(b);db=FinanceDb(this);showHome()}
    override fun onResume(){super.onResume();if(::db.isInitialized) when(selectedNav){0->showHome();1->showTransactions();2->showReports();3->showSettings()}}

    private fun tv(s:String,size:Float=14f,color:Int=white,bold:Boolean=false)=TextView(this).apply{text=s;textSize=size;setTextColor(color);if(bold)setTypeface(null,1);setPadding(0,2,0,2)}
    private fun button(s:String,action:()->Unit,primary:Boolean=false)=Button(this).apply{
        text=s;textSize=13f;setTextColor(if(primary)Color.WHITE else white);isAllCaps=false
        setBackgroundColor(if(primary)Color.rgb(55,86,150) else panel2);setPadding(14,8,14,8);setOnClickListener{action()}
    }
    private fun input(hint:String="",value:String="",number:Boolean=false)=EditText(this).apply{
        this.hint=hint;setText(value);setSingleLine(true);setTextColor(white);setHintTextColor(muted)
        setBackgroundColor(panel2);setPadding(14,10,14,10);if(number)inputType=InputType.TYPE_CLASS_NUMBER
    }
    private fun page(title:String,subtitle:String=""){
        val root=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(16,12,16,8);setBackgroundColor(bg)}
        val head=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL}
        head.addView(tv("duitw",25f,accent,true));head.addView(tv(title,20f,white,true));if(subtitle.isNotBlank())head.addView(tv(subtitle,12f,muted))
        root.addView(head,LinearLayout.LayoutParams(-1,-2).apply{bottomMargin=12})
        val scroll=ScrollView(this);content=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL};scroll.addView(content);root.addView(scroll,LinearLayout.LayoutParams(-1,0,1f))
        val nav=LinearLayout(this).apply{setPadding(0,6,0,0);setBackgroundColor(panel)}
        navLabels.forEachIndexed{i,n->val b=button(n,{selectedNav=i;when(i){0->showHome();1->showTransactions();2->showReports();3->showSettings()}},i==selectedNav);b.textSize=11f;nav.addView(b,LinearLayout.LayoutParams(0,54,1f))}
        root.addView(nav);setContentView(root)
    }
    private fun section(s:String){content.addView(tv(s,16f,white,true).apply{setPadding(2,14,0,7)})}
    private fun card(title:String,value:String,color:Int=white,sub:String=""){
        val box=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(16,14,16,14);setBackgroundColor(panel)}
        box.addView(tv(title.uppercase(),11f,muted,true));box.addView(tv(value,22f,color,true));if(sub.isNotBlank())box.addView(tv(sub,11f,muted))
        content.addView(box,LinearLayout.LayoutParams(-1,-2).apply{bottomMargin=9})
    }
    private fun row(text:String,action:()->Unit,second:String?=null){
        val r=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL;setPadding(14,10,8,10);setBackgroundColor(panel)}
        val left=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL};left.addView(tv(text,14f,white,true));second?.let{left.addView(tv(it,11f,muted))}
        r.addView(left,LinearLayout.LayoutParams(0,-2,1f));r.addView(button("Buka",action));content.addView(r,LinearLayout.LayoutParams(-1,-2).apply{bottomMargin=7})
    }
    private fun money(v:Long)=money.format(v)
    private fun toast(s:String)=Toast.makeText(this,s,Toast.LENGTH_SHORT).show()

    private fun showHome(){
        selectedNav=0;val name=db.setting("user_name","").trim();page("Beranda",if(name.isBlank())"Ringkasan keuangan pribadi" else "Halo, $name")
        card("Total saldo",money(db.totalBalance()),accent,"Semua rekening • offline")
        val m=YearMonth.now().toString();val tx=db.transactions(100000,fromDate="$m-01",toDate="$m-31")
        val inc=tx.filter{it.type=="income"}.sumOf{it.amount};val exp=tx.filter{it.type=="expense"}.sumOf{it.amount}
        val grid=LinearLayout(this);val a=LinearLayout.LayoutParams(0,-2,1f).apply{rightMargin=5};val b=LinearLayout.LayoutParams(0,-2,1f).apply{leftMargin=5}
        grid.addView(stat("Pemasukan",money(inc),green),a);grid.addView(stat("Pengeluaran",money(exp),red),b);content.addView(grid,LinearLayout.LayoutParams(-1,-2).apply{bottomMargin=10})
        section("Arus kas bulan ini");card("Selisih",money(inc-exp),if(inc-exp>=0) green else red,"Pemasukan − pengeluaran")
        section("Grafik 6 bulan terakhir")
        content.addView(MonthChart(this, db), LinearLayout.LayoutParams(-1,190).apply{bottomMargin=10})
        section("Rekening");db.accounts().forEach{a->row(a.name,{accountDialog(a)}, "${a.kind} • ${money(a.balance)}")}
        section("Transaksi terbaru");db.transactions(5).forEach{txRow(it)}
        content.addView(button("+ Catat transaksi",::transactionDialog,true));content.addView(button("+ Tambah rekening",::addAccountDialog))
        content.addView(button("Piutang & kewajiban",::debtsPage))
    }
    private fun stat(t:String,v:String,c:Int)=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(14,12,10,12);setBackgroundColor(panel);addView(tv(t,11f,muted,true));addView(tv(v,16f,c,true))}

    private fun txRow(t:Tx){
        val names=db.accounts().associate{it.id to it.name}
        val title=when(t.type){"income"->"↑ ${t.category}";"expense"->"↓ ${t.category}";"transfer"->"↔ Transfer";else->"Saldo awal"}
        val detail=when(t.type){"income"->"Ke ${names[t.toId]?:"rekening"}";"expense"->"Dari ${names[t.fromId]?:"rekening"}";"transfer"->"${names[t.fromId]?:"?"} → ${names[t.toId]?:"?"}";else->"Ke ${names[t.toId]?:"rekening"}"}
        val r=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(14,11,14,11);setBackgroundColor(panel)}
        val top=LinearLayout(this).apply{gravity=Gravity.CENTER_VERTICAL};top.addView(tv(title,14f,white,true),LinearLayout.LayoutParams(0,-2,1f));top.addView(tv(if(t.type=="income")"+ ${money(t.amount)}" else if(t.type=="expense")"- ${money(t.amount)}" else money(t.amount),14f,if(t.type=="income") green else if(t.type=="expense") red else accent,true));r.addView(top)
        r.addView(tv("${t.date} • $detail${if(t.note.isNotBlank())" • ${t.note}" else ""}",11f,muted));r.setOnClickListener{editTransactionDialog(t)}
        content.addView(r,LinearLayout.LayoutParams(-1,-2).apply{bottomMargin=7})
    }

    private fun showTransactions(){
        selectedNav=1;page("Transaksi","Cari, filter, edit, atau hapus transaksi")
        val search=input("Cari kategori atau catatan");content.addView(search,LinearLayout.LayoutParams(-1,50).apply{bottomMargin=6})
        val filter=Spinner(this);filter.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,arrayOf("Semua jenis","Pemasukan","Pengeluaran","Transfer"))
        content.addView(filter,LinearLayout.LayoutParams(-1,50).apply{bottomMargin=6})
        val from=input("Dari tanggal YYYY-MM-DD");val to=input("Sampai tanggal YYYY-MM-DD")
        content.addView(from);content.addView(to)
        content.addView(button("Terapkan filter",{renderTransactions(search.text.toString(),filter.selectedItemPosition,from.text.toString(),to.text.toString())},true))
        content.addView(button("+ Tambah transaksi",::transactionDialog))
        renderTransactions("","", "", "")
    }
    private fun renderTransactions(search:String,typePos:Any,from:String,to:String){
        val container=content
        if(container.childCount>6)while(container.childCount>6)container.removeViewAt(6)
        val tp=if(typePos is Int)typePos else -1
        val type=when(tp){1->"income";2->"expense";3->"transfer";else->""}
        val list=db.transactions(1000,search,type,from,to)
        if(list.isEmpty())container.addView(tv("Tidak ada transaksi yang cocok.",13f,muted).apply{setPadding(4,18,0,18)})
        list.forEach{txRow(it)}
    }

    private fun showReports(){
        selectedNav=2;page("Laporan","Ringkasan berdasarkan periode")
        val spinner=Spinner(this);spinner.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,arrayOf("Hari ini","Minggu ini","Bulan ini","Tahun ini","Semua data"))
        content.addView(spinner,LinearLayout.LayoutParams(-1,50).apply{bottomMargin=7})
        val from=input("Dari YYYY-MM-DD");val to=input("Sampai YYYY-MM-DD")
        content.addView(from);content.addView(to);content.addView(button("Tampilkan",{renderReport(spinner.selectedItemPosition,from.text.toString(),to.text.toString())},true))
        renderReport(2,"","")
    }
    private fun period(pos:Int,from:String,to:String):Pair<String,String>{
        if(from.isNotBlank()||to.isNotBlank())return from to to
        val now=LocalDate.now();return when(pos){
            0->now.toString() to now.toString()
            1->now.minusDays(6).toString() to now.toString()
            2->now.withDayOfMonth(1).toString() to now.withDayOfMonth(now.lengthOfMonth()).toString()
            3->now.withDayOfYear(1).toString() to now.withDayOfYear(now.lengthOfYear()).toString()
            else->"" to ""
        }
    }
    private fun renderReport(pos:Int,from:String,to:String){
        while(content.childCount>4)content.removeViewAt(4)
        val p=period(pos,from,to);val tx=db.transactions(100000,fromDate=p.first,toDate=p.second)
        val inc=tx.filter{it.type=="income"}.sumOf{it.amount};val exp=tx.filter{it.type=="expense"}.sumOf{it.amount}
        card("Total pemasukan",money(inc),green);card("Total pengeluaran",money(exp),red);card("Selisih",money(inc-exp),if(inc>=exp) green else red)
        section("Pengeluaran per kategori")
        val cats=tx.filter{it.type=="expense"}.groupBy{it.category}.mapValues{it.value.sumOf{v->v.amount}}.toList().sortedByDescending{it.second}
        if(cats.isEmpty())content.addView(tv("Belum ada pengeluaran pada periode ini.",12f,muted))
        cats.forEach{(c,v)->row(c,{},"${money(v)} • ${if(exp>0)v*100/exp else 0}%")}
        section("Saldo rekening saat ini");db.accounts().forEach{a->row(a.name,{},money(a.balance))}
        content.addView(tv("Transfer tidak dihitung sebagai pemasukan/pengeluaran.",11f,muted).apply{setPadding(2,12,0,8)})
    }

    private fun showSettings(){
        selectedNav=3;page("Pengaturan","Data, rekening, kategori, dan backup")
        val name=input("Nama pengguna",db.setting("user_name",""));content.addView(name)
        content.addView(button("Simpan nama",{db.setSetting("user_name",name.text.toString().trim());toast("Nama tersimpan");showSettings()},true))
        section("Rekening");content.addView(button("+ Tambah rekening",::addAccountDialog));db.accounts().forEach{row(it.name,{accountDialog(it)},"${it.kind} • ${money(it.balance)}")}
        section("Kategori");content.addView(button("Kelola kategori",::categoriesDialog))
        section("Piutang & kewajiban");content.addView(button("Kelola piutang/kewajiban",::debtsPage))
        section("Backup & restore");content.addView(button("Ekspor backup JSON",::backup));content.addView(button("Impor / restore JSON",::restore))
        section("Aplikasi");content.addView(tv("duitw • versi 2.0.0\nData tersimpan lokal di perangkat. Tidak ada login, server, atau internet.",12f,muted))
    }

    private fun addAccountDialog(){
        val name=input("Nama rekening");val kind=Spinner(this);kind.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,arrayOf("Tunai","Bank","E-wallet","Lainnya"));val opening=input("Saldo awal (Rp)","",true)
        val box=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(20,4,20,0);addView(name);addView(kind);addView(opening)}
        AlertDialog.Builder(this).setTitle("Tambah rekening").setView(box).setNegativeButton("Batal",null).setPositiveButton("Simpan"){_,_->try{db.addAccount(name.text.toString(),kind.selectedItem.toString(),opening.text.toString().toLongOrNull()?:0);showSettings()}catch(e:Exception){toast(e.message?:"Gagal")}}.show()
    }
    private fun accountDialog(a:Account){
        val name=input("Nama rekening",a.name);val kind=Spinner(this);kind.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,arrayOf("Tunai","Bank","E-wallet","Lainnya"));kind.setSelection(arrayOf("Tunai","Bank","E-wallet","Lainnya").indexOf(a.kind).coerceAtLeast(0))
        val box=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(20,4,20,0);addView(name);addView(kind)}
        AlertDialog.Builder(this).setTitle("Rekening").setView(box).setNegativeButton("Tutup",null).setNeutralButton("Hapus"){_,_->confirm("Hapus rekening ${a.name}?"){try{db.deleteAccount(a.id);showSettings()}catch(e:Exception){toast(e.message?:"Tidak bisa dihapus")}}}.setPositiveButton("Simpan"){_,_->try{db.updateAccount(a.id,name.text.toString(),kind.selectedItem.toString());showSettings()}catch(e:Exception){toast(e.message?:"Gagal")}}.show()
    }

    private fun categoriesDialog(){
        val types=arrayOf("Pemasukan","Pengeluaran");val sp=Spinner(this);sp.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,types)
        val list=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL};val scroll=ScrollView(this);scroll.addView(list)
        fun render(){list.removeAllViews();val type=if(sp.selectedItemPosition==0)"income" else "expense";db.categories(type).forEach{c->
            val r=LinearLayout(this).apply{gravity=Gravity.CENTER_VERTICAL};r.addView(tv(c.name,14f,white,true),LinearLayout.LayoutParams(0,50,1f));r.addView(button("Edit",{editCategory(c)}));r.addView(button("Hapus",{confirm("Hapus kategori ${c.name}?"){db.deleteCategory(c.id);render()}}));list.addView(r)}}
        sp.onItemSelectedListener=object:AdapterView.OnItemSelectedListener{override fun onNothingSelected(p:AdapterView<*>?){};override fun onItemSelected(p:AdapterView<*>?,v:View?,pos:Int,id:Long){render()}}
        val add=button("+ Kategori",{val n=input("Nama kategori");AlertDialog.Builder(this).setTitle("Tambah kategori").setView(n).setNegativeButton("Batal",null).setPositiveButton("Simpan"){_,_->try{db.addCategory(n.text.toString(),if(sp.selectedItemPosition==0)"income" else "expense");render()}catch(e:Exception){toast(e.message?:"Gagal")}}.show()})
        val box=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(18,4,18,0);addView(sp);addView(add);addView(scroll,LinearLayout.LayoutParams(-1,0,1f))}
        AlertDialog.Builder(this).setTitle("Kategori").setView(box).setPositiveButton("Selesai",null).show()
    }
    private fun editCategory(c:Category){val n=input("Nama kategori",c.name);AlertDialog.Builder(this).setTitle("Edit kategori").setView(n).setNegativeButton("Batal",null).setPositiveButton("Simpan"){_,_->try{db.updateCategory(c.id,n.text.toString());categoriesDialog()}catch(e:Exception){toast(e.message?:"Gagal")}}.show()}

    private fun transactionDialog(existing:Tx?=null){
        val ac=db.accounts();if(ac.isEmpty()){toast("Tambahkan rekening dahulu");return}
        val type=Spinner(this);type.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,arrayOf("Pemasukan","Pengeluaran","Transfer"))
        existing?.let{type.setSelection(if(it.type=="income")0 else if(it.type=="expense")1 else 2)}
        val amount=input("Nominal (Rp)",existing?.amount?.toString()?:"",true)
        val cat=Spinner(this);val from=Spinner(this);val to=Spinner(this)
        fun loadCats(){val names=db.categories(if(type.selectedItemPosition==0)"income" else "expense").map{it.name};cat.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,names);existing?.let{e->val i=names.indexOf(e.category);if(i>=0)cat.setSelection(i)}}
        cat.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,db.categories("income").map{it.name})
        from.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,ac.map{it.name});to.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,ac.map{it.name})
        val note=input("Catatan (opsional)",existing?.note?:"");val d=input("Tanggal YYYY-MM-DD",existing?.date?:date)
        fun selectById(sp:Spinner,id:Long){val i=ac.indexOfFirst{it.id==id};if(i>=0)sp.setSelection(i)}
        existing?.let{selectById(from,it.fromId);selectById(to,it.toId)}
        val box=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(18,4,18,0)}
        box.addView(type);box.addView(amount);box.addView(cat);box.addView(from);box.addView(to);box.addView(note);box.addView(d)
        fun updateVisibility(){val p=type.selectedItemPosition;from.visibility=if(p==0)View.GONE else View.VISIBLE;to.visibility=if(p==1)View.GONE else View.VISIBLE;loadCats()}
        type.onItemSelectedListener=object:AdapterView.OnItemSelectedListener{override fun onNothingSelected(p:AdapterView<*>?){};override fun onItemSelected(p:AdapterView<*>?,v:View?,pos:Int,id:Long){updateVisibility()}}
        val dialog=AlertDialog.Builder(this).setTitle(if(existing==null)"Catat transaksi" else "Edit transaksi").setView(ScrollView(this).apply{addView(box)}).setNegativeButton("Batal",null).setPositiveButton("Simpan",null).apply{if(existing!=null)setNeutralButton("Hapus",null)}.create()
        dialog.setOnShowListener{dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener{
            try{val n=amount.text.toString().toLong();val dt=d.text.toString();val p=type.selectedItemPosition;val c=cat.selectedItem?.toString()?:"Lainnya"
                val f:Long=if(p==0)0L else ac[from.selectedItemPosition].id;val t:Long=if(p==1)0L else ac[to.selectedItemPosition].id
                if(existing==null)db.addTransaction(if(p==0)"income" else if(p==1)"expense" else "transfer",n,c,note.text.toString(),f,t,dt)
                else db.updateTransaction(existing.id,if(p==0)"income" else if(p==1)"expense" else "transfer",n,c,note.text.toString(),f,t,dt,existing.debtId)
                dialog.dismiss();showTransactions()
            }catch(e:Exception){toast(e.message?:"Transaksi gagal")}
        };dialog.getButton(AlertDialog.BUTTON_NEUTRAL)?.setOnClickListener{confirm("Hapus transaksi ini?"){db.deleteTransaction(existing!!.id);dialog.dismiss();showTransactions()}}}
        dialog.show();updateVisibility()
    }
    private fun editTransactionDialog(t:Tx)=transactionDialog(t)

    private fun debtsPage(){
        page("Piutang & kewajiban","Belum lunas tidak mengubah saldo rekening")
        content.addView(button("+ Piutang", {debtDialog("receivable")},true));content.addView(button("+ Kewajiban",{debtDialog("payable")}))
        section("Piutang");db.debts("receivable").forEach{debtRow(it)}
        section("Kewajiban");db.debts("payable").forEach{debtRow(it)}
    }
    private fun debtRow(d:Debt){
        val remain=d.amount-d.paid;val title=if(d.kind=="receivable")"Piutang • ${d.person}" else "Kewajiban • ${d.person}"
        row(title,{debtDetail(d)},"${money(remain)} tersisa • ${d.date}")
    }
    private fun debtDialog(kind:String){
        val person=input("Nama orang / pihak");val amount=input("Nominal (Rp)","",true);val d=input("Tanggal YYYY-MM-DD",date);val note=input("Catatan")
        val box=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(20,4,20,0);listOf(person,amount,d,note).forEach{addView(it)}}
        AlertDialog.Builder(this).setTitle(if(kind=="receivable")"Catat piutang" else "Catat kewajiban").setView(box).setNegativeButton("Batal",null).setPositiveButton("Simpan"){_,_->try{db.addDebt(kind,person.text.toString(),amount.text.toString().toLong(),d.text.toString(),note.text.toString());debtsPage()}catch(e:Exception){toast(e.message?:"Gagal")}}.show()
    }
    private fun debtDetail(d:Debt){
        val remain=d.amount-d.paid;val msg="Total: ${money(d.amount)}\nTerbayar: ${money(d.paid)}\nSisa: ${money(remain)}\nTanggal: ${d.date}\n${d.note}"
        val b=AlertDialog.Builder(this).setTitle(if(d.kind=="receivable")"Piutang • ${d.person}" else "Kewajiban • ${d.person}").setMessage(msg)
        if(remain>0)b.setPositiveButton("Catat pembayaran"){_,_->paymentDialog(d)}
        b.setNeutralButton("Hapus"){_,_->confirm("Hapus catatan ini?"){try{db.deleteDebt(d.id);debtsPage()}catch(e:Exception){toast(e.message?:"Tidak bisa dihapus")}}}.setNegativeButton("Tutup",null).show()
    }
    private fun paymentDialog(d:Debt){
        val ac=db.accounts();val amount=input("Nominal pembayaran (Rp)","",true);val sp=Spinner(this);sp.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,ac.map{it.name});val dt=input("Tanggal YYYY-MM-DD",date);val note=input("Catatan")
        val box=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(20,4,20,0);listOf(amount,sp,dt,note).forEach{addView(it)}}
        AlertDialog.Builder(this).setTitle("Catat pembayaran").setView(box).setNegativeButton("Batal",null).setPositiveButton("Simpan"){_,_->try{db.addDebtPayment(d.id,amount.text.toString().toLong(),ac[sp.selectedItemPosition].id,dt.text.toString(),note.text.toString());debtsPage()}catch(e:Exception){toast(e.message?:"Gagal")}}.show()
    }

    private fun backup(){val i=Intent(Intent.ACTION_CREATE_DOCUMENT).apply{addCategory(Intent.CATEGORY_OPENABLE);type="application/json";putExtra(Intent.EXTRA_TITLE,"duitw-backup-${LocalDate.now()}.json")};startActivityForResult(i,exportCode)}
    private fun restore(){val i=Intent(Intent.ACTION_OPEN_DOCUMENT).apply{addCategory(Intent.CATEGORY_OPENABLE);type="application/json"};startActivityForResult(i,importCode)}
    @Deprecated("Legacy document picker callback")
    override fun onActivityResult(requestCode:Int,resultCode:Int,data:Intent?){
        super.onActivityResult(requestCode,resultCode,data)
        if(resultCode!=RESULT_OK)return
        val uri=data?.data?:return
        try{
            if(requestCode==exportCode){
                contentResolver.openOutputStream(uri)?.use{it.write(db.exportJson().toByteArray())}
                toast("Backup berhasil")
            }else if(requestCode==importCode){
                val raw=contentResolver.openInputStream(uri)?.bufferedReader()?.use{it.readText()}?:error("File kosong")
                JSONObjectValidator.validate(raw)
                confirm("Restore akan mengganti seluruh data lokal. Lanjutkan?"){
                    try{db.restoreJson(raw);toast("Restore berhasil");showHome()}catch(e:Exception){toast(e.message?:"Restore gagal")}
                }
            }
        }catch(e:Exception){toast(e.message?:"File tidak dapat diproses")}
    }
    private object JSONObjectValidator{fun validate(raw:String){val o=org.json.JSONObject(raw);require(o.optString("app")=="duitw"){"File bukan backup duitw"};require(o.has("accounts")&&o.has("transactions")){"Backup tidak lengkap"}}}

    private fun confirm(message:String,yes:()->Unit){AlertDialog.Builder(this).setMessage(message).setNegativeButton("Batal",null).setPositiveButton("Ya"){_,_->yes()}.show()}
    private inner class MonthChart(context: Context, private val db: FinanceDb) : View(context) {
        private val paint=android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG)
        override fun onDraw(c:android.graphics.Canvas){
            super.onDraw(c)
            paint.textSize=11f;paint.color=Color.rgb(150,164,183)
            val months=(0..5).map{YearMonth.now().minusMonths((5-it).toLong())}
            val vals=months.map{m->
                val tx=db.transactions(100000,fromDate=m.toString()+"-01",toDate=m.toString()+"-"+m.lengthOfMonth())
                tx.filter{it.type=="income"}.sumOf{it.amount} to tx.filter{it.type=="expense"}.sumOf{it.amount}
            }
            val max=(vals.flatMap{listOf(it.first,it.second)}.maxOrNull()?:1L).coerceAtLeast(1L)
            val w=width.toFloat()/months.size;val base=height-35f;val bar=10f
            months.forEachIndexed{i,m->
                val x=w*i+w/2;val inc=vals[i].first.toFloat()/max*(height-65);val exp=vals[i].second.toFloat()/max*(height-65)
                paint.color=green;c.drawRoundRect(x-bar-2,base-inc,x-2,base,4f,4f,paint)
                paint.color=red;c.drawRoundRect(x+2,base-exp,x+bar+2,base,4f,4f,paint)
                paint.color=Color.rgb(150,164,183);paint.textAlign=android.graphics.Paint.Align.CENTER
                c.drawText(m.month.name.take(3),x,height-12f,paint)
            }
        }
    }

}
