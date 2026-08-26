const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main(){
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@delgusto.ba';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeThisImmediately!2026';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const restaurant = await prisma.restaurant.upsert({
    where:{slug:'del-gusto'},
    update:{name:'DEL GUSTO',active:true},
    create:{
      slug:'del-gusto', name:'DEL GUSTO', tagline:'Premium dining · Sarajevo', accent:'#E4A15D',
      phone:'+387 66 010 101', address:'Butmirska cesta 16A, Sarajevo 71210',
      hours:'Pon–Ned 08:00–23:00', hero:'Premium gastronomsko iskustvo u srcu Sarajeva', logo:'DG',
      settings:{create:{currency:'KM',language:'bs',timezone:'Europe/Sarajevo',reservationEnabled:true,qrOrderingEnabled:true}}
    }
  });

  await prisma.user.upsert({
    where:{restaurantId_email:{restaurantId:restaurant.id,email:adminEmail.toLowerCase()}},
    update:{name:'Del Gusto Admin',passwordHash,role:'ADMIN',active:true},
    create:{restaurantId:restaurant.id,name:'Del Gusto Admin',email:adminEmail.toLowerCase(),passwordHash,role:'ADMIN'}
  });
  const staff=[
    ['Konobar 1','konobar@delgusto.ba','WAITER'],
    ['Kuhinja','kuhinja@delgusto.ba','KITCHEN']
  ];
  for(const [name,email,role] of staff){
    await prisma.user.upsert({where:{restaurantId_email:{restaurantId:restaurant.id,email}},update:{name,passwordHash,role,active:true},create:{restaurantId:restaurant.id,name,email,passwordHash,role}})
  }

  if(await prisma.restaurantTable.count({where:{restaurantId:restaurant.id}})===0){
    const positions=[[90,90],[270,90],[450,90],[630,90],[90,280],[270,280],[450,280],[630,280],[160,450],[520,450]];
    await prisma.restaurantTable.createMany({data:positions.map((p,i)=>({restaurantId:restaurant.id,name:`Sto ${i+1}`,zone:i<6?'GLAVNA SALA':'TERASA',capacity:i%4===0?6:4,status:'SLOBODAN',x:p[0],y:p[1],shape:i>7?'round':'square'}))});
  }

  const menu = {
    'DORUČAK / BREAKFAST':[
      ['Del Gusto breakfast','Hummus, mutabel i falafel — signature doručak kuće.',16],
      ['Bosnian breakfast','Suho meso, sudžuk, fritule i Nutella.',15],
      ['Taco breakfast','Tortilje, jaja, svježa salsa i sour cream.',13]
    ],
    'MAIN DISHES':[
      ['Del Gusto mixed grill','Pažljivo odabran miks mesa sa roštilja.',35],
      ['Premium Del Gusto roasted veal','Premium pečena teletina kuće.',30],
      ['Lamb Mandi','Aromatična janjetina sa mandi rižom.',45],
      ['Chicken wok','Piletina iz woka sa svježim povrćem.',14]
    ],
    'STEAKS':[
      ['Beefsteak','Premium komad govedine, grilovan po želji.',55],
      ['Rump steak','Rump steak izraženog karaktera i bogatog okusa.',35]
    ],
    'PASTA':[
      ['Chef’s signature pasta','Gnocchi, govedina i kremasti gorgonzola sos.',20],
      ['Spicy chicken pasta','Piletina u pikantnom paradajz sosu i tjestenina.',16],
      ['Chicken pasta with broccoli','Kremasta pasta sa piletinom i brokulom.',16]
    ],
    'PIZZA & PIDE':[
      ['Margherita','Klasična pizza sa paradajzom, mozzarellom i bosiljkom.',12],
      ['Capricciosa','Pizza sa bogatim klasičnim nadjevom.',13],
      ['Mexicana','Začinjena pizza punog okusa.',14]
    ],
    'DESSERTS':[
      ['San Sebastián cheesecake','Kremasti baskijski cheesecake.',9],
      ['Baklava','Tradicionalna baklava.',9],
      ['Realistic cakes','Premium desert iz selekcije kuće.',12]
    ],
    'COFFEE & DRINKS':[
      ['Espresso','Klasični espresso.',3],
      ['Cappuccino','Espresso i mliječna pjena.',4],
      ['Spanish latte','Kremasti latte sa slatkim završetkom.',7],
      ['Del Gusto Mojito','Signature bezalkoholni mojito.',14]
    ]
  };
  if(await prisma.menuItem.count({where:{restaurantId:restaurant.id}})===0){
    let order=0;
    for(const [cat,items] of Object.entries(menu)){
      const category=await prisma.menuCategory.create({data:{restaurantId:restaurant.id,name:cat,sortOrder:order++}});
      let itemOrder=0;
      for(const [name,description,price] of items){
        await prisma.menuItem.create({data:{restaurantId:restaurant.id,categoryId:category.id,name,description,price,sortOrder:itemOrder++}})
      }
    }
  }
  console.log(`Seed complete. Admin: ${adminEmail}`);
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
