const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { PrismaClient, Prisma } = require('@prisma/client');
const { Server } = require('socket.io');

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: false });
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const COOKIE = 'dg_session';
const isProd = process.env.NODE_ENV === 'production';
const allowedOrigin = process.env.APP_ORIGIN || '';

if (isProd && JWT_SECRET === 'dev-only-change-me') {
  console.error('FATAL: JWT_SECRET must be set in production.');
  process.exit(1);
}

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProd ? '1h' : 0 }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const publicLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 80, standardHeaders: true, legacyHeaders: false });

function safeRestaurant(r) {
  return { id:r.id, slug:r.slug, name:r.name, tagline:r.tagline, accent:r.accent, phone:r.phone, address:r.address, hours:r.hours, hero:r.hero, logo:r.logo };
}
function moneyNum(v){ return Number(v ?? 0); }
function orderDTO(o){
  return { ...o, total:moneyNum(o.total), items:(o.items||[]).map(i=>({...i,price:moneyNum(i.price)})) };
}
function menuDTO(i){ return {...i, price:moneyNum(i.price), category:i.category?.name || i.category || 'Ostalo'}; }
function csrf(){ return crypto.randomBytes(24).toString('hex'); }
function signSession(user){
  const token = jwt.sign({ uid:user.id, rid:user.restaurantId, role:user.role, name:user.name, csrf:csrf() }, JWT_SECRET, { expiresIn:'12h', issuer:'delgusto-os' });
  return token;
}
function readSession(req){
  const token = req.cookies[COOKIE];
  if(!token) return null;
  try { return jwt.verify(token, JWT_SECRET, { issuer:'delgusto-os' }); } catch { return null; }
}
function requireAuth(req,res,next){
  const s = readSession(req);
  if(!s) return res.status(401).json({error:'Sesija je istekla. Prijavite se ponovo.'});
  req.session=s; next();
}
function roles(...allowed){ return (req,res,next)=> allowed.includes(req.session.role) ? next() : res.status(403).json({error:'Nemate dozvolu za ovu radnju.'}); }
function requireCsrf(req,res,next){
  if(['GET','HEAD','OPTIONS'].includes(req.method)) return next();
  if(req.path.startsWith('/api/public/')) return next();
  const s=req.session || readSession(req);
  if(!s || req.get('x-csrf-token') !== s.csrf) return res.status(403).json({error:'Sigurnosni token nije validan. Osvježite stranicu.'});
  next();
}
function sameOrigin(req,res,next){
  if(['GET','HEAD','OPTIONS'].includes(req.method)) return next();
  if(!isProd) return next();
  const origin=req.get('origin');
  if(!origin || !allowedOrigin || origin === allowedOrigin) return next();
  return res.status(403).json({error:'Nedozvoljen origin.'});
}
app.use(sameOrigin);

async function getRestaurant(){ return prisma.restaurant.findUnique({where:{slug:'del-gusto'},include:{settings:true}}); }
async function audit(req, action, entity, entityId, meta){
  try { await prisma.auditLog.create({data:{restaurantId:req.session.rid,userId:req.session.uid,action,entity,entityId:String(entityId||''),meta:meta||undefined}}); } catch {}
}
async function notify(rid,text,type='info'){
  const n=await prisma.notification.create({data:{restaurantId:rid,text,type}});
  io.to(`restaurant:${rid}`).emit('notification',n);
  return n;
}
async function stateFor(rid){
  const [restaurant,menu,tables,reservations,orders,notifications,staff]=await Promise.all([
    prisma.restaurant.findUnique({where:{id:rid},include:{settings:true}}),
    prisma.menuItem.findMany({where:{restaurantId:rid},include:{category:true},orderBy:[{category:{sortOrder:'asc'}},{sortOrder:'asc'},{name:'asc'}]}),
    prisma.restaurantTable.findMany({where:{restaurantId:rid},orderBy:{id:'asc'}}),
    prisma.reservation.findMany({where:{restaurantId:rid},orderBy:{createdAt:'desc'},take:250}),
    prisma.order.findMany({where:{restaurantId:rid},include:{items:true},orderBy:{createdAt:'desc'},take:300}),
    prisma.notification.findMany({where:{restaurantId:rid},orderBy:{createdAt:'desc'},take:100}),
    prisma.user.findMany({where:{restaurantId:rid},select:{id:true,name:true,email:true,role:true,active:true,createdAt:true},orderBy:{id:'asc'}})
  ]);
  return {restaurant:safeRestaurant(restaurant),settings:restaurant.settings,menu:menu.map(menuDTO),tables,reservations,orders:orders.map(orderDTO),notifications,staff};
}

app.get('/api/health', async (req,res)=>{
  try{ await prisma.$queryRaw`SELECT 1`; res.json({ok:true,service:'Del Gusto Restaurant OS',time:new Date().toISOString()}); }
  catch{ res.status(503).json({ok:false}); }
});
app.get('/api/restaurants', async (req,res)=>{ const r=await getRestaurant(); res.json(r?[safeRestaurant(r)]:[]); });
app.get('/api/public/:slug', publicLimiter, async (req,res)=>{
  const r=await prisma.restaurant.findUnique({where:{slug:req.params.slug},include:{settings:true}});
  if(!r || !r.active) return res.status(404).json({error:'Restoran nije pronađen.'});
  const [menu,tables]=await Promise.all([
    prisma.menuItem.findMany({where:{restaurantId:r.id,visible:true},include:{category:true},orderBy:[{category:{sortOrder:'asc'}},{sortOrder:'asc'}]}),
    prisma.restaurantTable.findMany({where:{restaurantId:r.id},select:{id:true,name:true,zone:true,capacity:true},orderBy:{id:'asc'}})
  ]);
  res.json({restaurant:safeRestaurant(r),settings:r.settings,menu:menu.map(menuDTO),tables});
});

const reservationSchema=z.object({name:z.string().trim().min(2).max(80),phone:z.string().trim().min(6).max(30),date:z.string().min(8).max(10),time:z.string().min(4).max(5),guests:z.coerce.number().int().min(1).max(30),zone:z.string().trim().max(50).optional(),message:z.string().trim().max(500).optional()});
app.post('/api/public/:slug/reservations', publicLimiter, async (req,res)=>{
  const parsed=reservationSchema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:'Provjerite podatke rezervacije.'});
  const r=await prisma.restaurant.findUnique({where:{slug:req.params.slug},include:{settings:true}}); if(!r?.active) return res.status(404).json({error:'Restoran nije pronađen.'});
  if(r.settings && !r.settings.reservationEnabled) return res.status(403).json({error:'Online rezervacije su trenutno isključene.'});
  const x=await prisma.reservation.create({data:{restaurantId:r.id,...parsed.data,status:'NA ČEKANJU'}});
  await notify(r.id,`Nova rezervacija: ${x.name} · ${x.guests} gostiju`,'reservation');
  io.to(`restaurant:${r.id}`).emit('reservations:changed');
  res.status(201).json(x);
});

const publicOrderSchema=z.object({tableId:z.coerce.number().int().positive(),items:z.array(z.object({id:z.coerce.number().int().positive(),qty:z.coerce.number().int().min(1).max(20)})).min(1).max(40),note:z.string().trim().max(300).optional()});
async function createOrder(r, body, source){
  const table=await prisma.restaurantTable.findFirst({where:{id:body.tableId,restaurantId:r.id}}); if(!table) throw new Error('Sto nije pronađen.');
  const ids=[...new Set(body.items.map(i=>i.id))];
  const dbItems=await prisma.menuItem.findMany({where:{restaurantId:r.id,id:{in:ids},visible:true}});
  const map=new Map(dbItems.map(i=>[i.id,i]));
  const items=body.items.map(i=>{const m=map.get(i.id); return m?{menuItemId:m.id,name:m.name,price:m.price,qty:i.qty}:null}).filter(Boolean);
  if(!items.length) throw new Error('Narudžba nema validnih artikala.');
  const total=items.reduce((s,i)=>s+Number(i.price)*i.qty,0);
  const order=await prisma.$transaction(async tx=>{
    const o=await tx.order.create({data:{restaurantId:r.id,tableId:table.id,source,status:'NOVA',note:body.note||'',total:new Prisma.Decimal(total),items:{create:items}},include:{items:true}});
    await tx.restaurantTable.update({where:{id:table.id},data:{status:'ZAUZET'}});
    return o;
  });
  await notify(r.id,`${source==='QR'?'QR':'Nova'} narudžba · ${table.name}`,'order');
  io.to(`restaurant:${r.id}`).emit('order:new',orderDTO(order));
  io.to(`restaurant:${r.id}`).emit('state:changed');
  return orderDTO(order);
}
app.post('/api/public/:slug/orders', publicLimiter, async (req,res)=>{
  const parsed=publicOrderSchema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:'Narudžba nije validna.'});
  const r=await prisma.restaurant.findUnique({where:{slug:req.params.slug},include:{settings:true}}); if(!r?.active) return res.status(404).json({error:'Restoran nije pronađen.'});
  if(r.settings && !r.settings.qrOrderingEnabled) return res.status(403).json({error:'QR naručivanje je trenutno isključeno.'});
  try{ res.status(201).json(await createOrder(r,parsed.data,'QR')); }catch(e){ res.status(400).json({error:e.message}); }
});

app.post('/api/login', authLimiter, async (req,res)=>{
  const parsed=z.object({restaurantSlug:z.string().default('del-gusto'),email:z.string().email(),password:z.string().min(6).max(128)}).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Unesite ispravan email i lozinku.'});
  const r=await prisma.restaurant.findUnique({where:{slug:parsed.data.restaurantSlug}}); if(!r?.active) return res.status(401).json({error:'Pristup nije dostupan.'});
  const user=await prisma.user.findFirst({where:{restaurantId:r.id,email:parsed.data.email.toLowerCase(),active:true}});
  if(!user || !(await bcrypt.compare(parsed.data.password,user.passwordHash))) return res.status(401).json({error:'Pogrešan email ili lozinka.'});
  const token=signSession(user); const payload=jwt.decode(token);
  res.cookie(COOKIE,token,{httpOnly:true,secure:isProd,sameSite:'strict',maxAge:12*60*60*1000,path:'/'});
  await prisma.auditLog.create({data:{restaurantId:r.id,userId:user.id,action:'LOGIN',entity:'User',entityId:String(user.id)}}).catch(()=>{});
  res.json({user:{id:user.id,name:user.name,email:user.email,role:user.role},restaurant:safeRestaurant(r),csrf:payload.csrf});
});
app.post('/api/logout', requireAuth, requireCsrf, async (req,res)=>{ res.clearCookie(COOKIE,{path:'/'}); await audit(req,'LOGOUT','User',req.session.uid); res.json({ok:true}); });
app.get('/api/auth/me', requireAuth, async (req,res)=>{
  const user=await prisma.user.findFirst({where:{id:req.session.uid,restaurantId:req.session.rid,active:true},include:{restaurant:true}});
  if(!user) return res.status(401).json({error:'Korisnik nije aktivan.'});
  res.json({user:{id:user.id,name:user.name,email:user.email,role:user.role},restaurant:safeRestaurant(user.restaurant),csrf:req.session.csrf});
});
app.use('/api', (req,res,next)=>{ if(req.path.startsWith('/public/')||req.path==='/login'||req.path==='/restaurants'||req.path==='/health'||req.path.startsWith('/auth/me')) return next(); requireAuth(req,res,()=>requireCsrf(req,res,next)); });

app.get('/api/state', async (req,res)=> res.json(await stateFor(req.session.rid)));

const orderSchema=z.object({tableId:z.coerce.number().int().positive(),items:z.array(z.object({id:z.coerce.number().int().positive(),qty:z.coerce.number().int().min(1).max(20)})).min(1).max(60),note:z.string().trim().max(300).optional(),source:z.enum(['WAITER']).optional()});
app.post('/api/orders', roles('ADMIN','WAITER'), async (req,res)=>{
  const parsed=orderSchema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:'Narudžba nije validna.'});
  const r=await prisma.restaurant.findUnique({where:{id:req.session.rid}});
  try{ const o=await createOrder(r,parsed.data,'WAITER'); await audit(req,'CREATE','Order',o.id,{tableId:o.tableId,total:o.total}); res.status(201).json(o); }catch(e){res.status(400).json({error:e.message});}
});
app.put('/api/orders/:id/status', roles('ADMIN','WAITER','KITCHEN'), async (req,res)=>{
  const status=String(req.body.status||''); const allowed=['NOVA','U PRIPREMI','SPREMNA','POSLUŽENA','OTKAZANA']; if(!allowed.includes(status)) return res.status(400).json({error:'Status nije validan.'});
  const o=await prisma.order.findFirst({where:{id:Number(req.params.id),restaurantId:req.session.rid}}); if(!o) return res.status(404).json({error:'Narudžba nije pronađena.'});
  const updated=await prisma.order.update({where:{id:o.id},data:{status},include:{items:true}}); await audit(req,'STATUS','Order',o.id,{status});
  io.to(`restaurant:${req.session.rid}`).emit('order:update',orderDTO(updated)); io.to(`restaurant:${req.session.rid}`).emit('state:changed'); res.json(orderDTO(updated));
});
app.post('/api/tables/:id/pay', roles('ADMIN','WAITER'), async (req,res)=>{
  const tableId=Number(req.params.id); const method=['CASH','CARD','OTHER'].includes(req.body?.method)?req.body.method:'CASH';
  const table=await prisma.restaurantTable.findFirst({where:{id:tableId,restaurantId:req.session.rid}}); if(!table) return res.status(404).json({error:'Sto nije pronađen.'});
  const result=await prisma.$transaction(async tx=>{
    const orders=await tx.order.findMany({where:{restaurantId:req.session.rid,tableId,status:{notIn:['NAPLAĆENA','OTKAZANA']}},include:{payment:true}});
    let total=0;
    for(const o of orders){
      total+=Number(o.total);
      await tx.order.update({where:{id:o.id},data:{status:'NAPLAĆENA',paidAt:new Date()}});
      if(!o.payment) await tx.payment.create({data:{orderId:o.id,amount:o.total,method}});
    }
    await tx.restaurantTable.update({where:{id:tableId},data:{status:'SLOBODAN'}});
    return {orders:orders.length,total};
  });
  await audit(req,'PAY','Table',tableId,{...result,method}); io.to(`restaurant:${req.session.rid}`).emit('state:changed'); res.json({ok:true,...result});
});

const menuCreate=z.object({name:z.string().trim().min(2).max(120),price:z.coerce.number().min(0).max(9999),category:z.string().trim().min(1).max(80),description:z.string().trim().max(500).optional(),visible:z.boolean().optional()});
app.post('/api/menu', roles('ADMIN'), async (req,res)=>{
  const p=menuCreate.safeParse(req.body); if(!p.success)return res.status(400).json({error:'Podaci artikla nisu validni.'});
  const c=await prisma.menuCategory.upsert({where:{restaurantId_name:{restaurantId:req.session.rid,name:p.data.category}},update:{visible:true},create:{restaurantId:req.session.rid,name:p.data.category}});
  const x=await prisma.menuItem.create({data:{restaurantId:req.session.rid,categoryId:c.id,name:p.data.name,description:p.data.description||'',price:p.data.price,visible:p.data.visible??true},include:{category:true}}); await audit(req,'CREATE','MenuItem',x.id); io.to(`restaurant:${req.session.rid}`).emit('state:changed'); res.status(201).json(menuDTO(x));
});
app.put('/api/menu/:id', roles('ADMIN'), async (req,res)=>{
  const id=Number(req.params.id); const old=await prisma.menuItem.findFirst({where:{id,restaurantId:req.session.rid}}); if(!old)return res.status(404).json({error:'Artikal nije pronađen.'});
  const p=menuCreate.partial().safeParse(req.body); if(!p.success)return res.status(400).json({error:'Podaci nisu validni.'});
  let categoryId=old.categoryId; if(p.data.category){const c=await prisma.menuCategory.upsert({where:{restaurantId_name:{restaurantId:req.session.rid,name:p.data.category}},update:{},create:{restaurantId:req.session.rid,name:p.data.category}});categoryId=c.id;}
  const data={...p.data}; delete data.category; if(categoryId)data.categoryId=categoryId;
  const x=await prisma.menuItem.update({where:{id},data,include:{category:true}}); await audit(req,'UPDATE','MenuItem',id); io.to(`restaurant:${req.session.rid}`).emit('state:changed'); res.json(menuDTO(x));
});
app.delete('/api/menu/:id', roles('ADMIN'), async (req,res)=>{
  const id=Number(req.params.id); const old=await prisma.menuItem.findFirst({where:{id,restaurantId:req.session.rid}}); if(!old)return res.status(404).json({error:'Artikal nije pronađen.'});
  await prisma.menuItem.delete({where:{id}}); await audit(req,'DELETE','MenuItem',id); io.to(`restaurant:${req.session.rid}`).emit('state:changed'); res.sendStatus(204);
});

app.put('/api/reservations/:id', roles('ADMIN','WAITER'), async (req,res)=>{
  const id=Number(req.params.id); const old=await prisma.reservation.findFirst({where:{id,restaurantId:req.session.rid}}); if(!old)return res.status(404).json({error:'Rezervacija nije pronađena.'});
  const status=String(req.body.status||old.status); if(!['NA ČEKANJU','POTVRĐENA','OTKAZANA','ZAVRŠENA'].includes(status))return res.status(400).json({error:'Status nije validan.'});
  const x=await prisma.reservation.update({where:{id},data:{status}}); await audit(req,'STATUS','Reservation',id,{status}); io.to(`restaurant:${req.session.rid}`).emit('state:changed'); res.json(x);
});

const tableSchema=z.object({name:z.string().trim().min(1).max(50),zone:z.string().trim().max(50).optional(),capacity:z.coerce.number().int().min(1).max(30).optional(),x:z.coerce.number().int().min(0).max(2000).optional(),y:z.coerce.number().int().min(0).max(1200).optional(),shape:z.string().max(20).optional()});
app.post('/api/tables', roles('ADMIN'), async (req,res)=>{
  const p=tableSchema.safeParse(req.body);if(!p.success)return res.status(400).json({error:'Podaci stola nisu validni.'});
  const x=await prisma.restaurantTable.create({data:{restaurantId:req.session.rid,zone:'SALA',capacity:4,x:80,y:80,shape:'square',...p.data}});await audit(req,'CREATE','Table',x.id);io.to(`restaurant:${req.session.rid}`).emit('state:changed');res.status(201).json(x);
});
app.put('/api/tables/:id', roles('ADMIN'), async (req,res)=>{
  const id=Number(req.params.id);const old=await prisma.restaurantTable.findFirst({where:{id,restaurantId:req.session.rid}});if(!old)return res.status(404).json({error:'Sto nije pronađen.'});
  const p=tableSchema.partial().safeParse(req.body);if(!p.success)return res.status(400).json({error:'Podaci nisu validni.'});const x=await prisma.restaurantTable.update({where:{id},data:p.data});await audit(req,'UPDATE','Table',id);io.to(`restaurant:${req.session.rid}`).emit('state:changed');res.json(x);
});

app.put('/api/notifications/read-all', async (req,res)=>{ await prisma.notification.updateMany({where:{restaurantId:req.session.rid,read:false},data:{read:true}});io.to(`restaurant:${req.session.rid}`).emit('state:changed');res.json({ok:true}); });
app.delete('/api/notifications', roles('ADMIN'), async (req,res)=>{ await prisma.notification.deleteMany({where:{restaurantId:req.session.rid}});res.sendStatus(204); });

app.get('/api/staff', roles('ADMIN'), async (req,res)=>{res.json(await prisma.user.findMany({where:{restaurantId:req.session.rid},select:{id:true,name:true,email:true,role:true,active:true,createdAt:true},orderBy:{id:'asc'}}));});
app.post('/api/staff', roles('ADMIN'), async (req,res)=>{
  const p=z.object({name:z.string().trim().min(2).max(80),email:z.string().email(),password:z.string().min(8).max(128),role:z.enum(['ADMIN','WAITER','KITCHEN'])}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Podaci korisnika nisu validni.'});
  const exists=await prisma.user.findFirst({where:{restaurantId:req.session.rid,email:p.data.email.toLowerCase()}});if(exists)return res.status(409).json({error:'Email već postoji.'});
  const passwordHash=await bcrypt.hash(p.data.password,12);const x=await prisma.user.create({data:{restaurantId:req.session.rid,name:p.data.name,email:p.data.email.toLowerCase(),passwordHash,role:p.data.role}});await audit(req,'CREATE','User',x.id);res.status(201).json({id:x.id,name:x.name,email:x.email,role:x.role,active:x.active});
});
app.put('/api/staff/:id', roles('ADMIN'), async (req,res)=>{
  const id=Number(req.params.id);if(id===req.session.uid && req.body.active===false)return res.status(400).json({error:'Ne možete deaktivirati vlastiti nalog.'});
  const old=await prisma.user.findFirst({where:{id,restaurantId:req.session.rid}});if(!old)return res.status(404).json({error:'Korisnik nije pronađen.'});
  const data={}; if(typeof req.body.active==='boolean')data.active=req.body.active;if(['ADMIN','WAITER','KITCHEN'].includes(req.body.role))data.role=req.body.role;if(req.body.name)data.name=String(req.body.name).trim();if(req.body.password){if(String(req.body.password).length<8)return res.status(400).json({error:'Lozinka mora imati najmanje 8 znakova.'});data.passwordHash=await bcrypt.hash(String(req.body.password),12);}
  const x=await prisma.user.update({where:{id},data});await audit(req,'UPDATE','User',id);res.json({id:x.id,name:x.name,email:x.email,role:x.role,active:x.active});
});

app.get('/api/settings', roles('ADMIN'), async (req,res)=>{const r=await prisma.restaurant.findUnique({where:{id:req.session.rid},include:{settings:true}});res.json({restaurant:safeRestaurant(r),settings:r.settings});});
app.put('/api/settings', roles('ADMIN'), async (req,res)=>{
  const p=z.object({phone:z.string().max(40).optional(),address:z.string().max(200).optional(),hours:z.string().max(100).optional(),tagline:z.string().max(120).optional(),hero:z.string().max(200).optional(),reservationEnabled:z.boolean().optional(),qrOrderingEnabled:z.boolean().optional()}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Postavke nisu validne.'});
  const {reservationEnabled,qrOrderingEnabled,...rdata}=p.data;await prisma.$transaction([prisma.restaurant.update({where:{id:req.session.rid},data:rdata}),prisma.restaurantSettings.upsert({where:{restaurantId:req.session.rid},update:{...(reservationEnabled!==undefined?{reservationEnabled}:{}),...(qrOrderingEnabled!==undefined?{qrOrderingEnabled}:{})},create:{restaurantId:req.session.rid,reservationEnabled:reservationEnabled??true,qrOrderingEnabled:qrOrderingEnabled??true}})]);await audit(req,'UPDATE','Settings',req.session.rid);io.to(`restaurant:${req.session.rid}`).emit('state:changed');res.json({ok:true});
});

io.use((socket,next)=>{
  const raw=socket.handshake.headers.cookie||'';
  const match=raw.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`)); if(!match)return next(new Error('unauthorized'));
  try{socket.session=jwt.verify(decodeURIComponent(match[1]),JWT_SECRET,{issuer:'delgusto-os'});next();}catch{next(new Error('unauthorized'));}
});
io.on('connection',socket=>{socket.join(`restaurant:${socket.session.rid}`);});

app.get(['/','/del-gusto'],(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.get(['/login','/app','/qr','/del-gusto/login','/del-gusto/app','/del-gusto/qr'],(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.get('*',(req,res)=>res.status(404).sendFile(path.join(__dirname,'public','index.html')));

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Del Gusto Restaurant OS running on 0.0.0.0:${PORT}`);
});
async function shutdown(){ await prisma.$disconnect(); server.close(()=>process.exit(0)); }
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
