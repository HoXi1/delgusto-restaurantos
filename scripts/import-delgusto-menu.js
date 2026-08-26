const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const menu = {
    'DORUČAK / BREAKFAST': [
        ['Taco breakfast', 13.00],
        ['Bosnian breakfast', 15.00],
        ['Del Gusto breakfast', 16.00],
        ['Omelette of your choice', 7.00],
    ],

    'SOUPS': [
        ["Bey's soup", 6.00],
        ['Lentil soup', 6.00],
        ['Soup of the day', 6.00],
        ['Pumpkin soup', 7.00],
    ],

    'APPETIZERS': [
        ['Hummus', 12.00],
        ['Hummus, Mutabel, Tahini', 12.00],
        ['Kibbeh', 12.00],
    ],

    'SALADS': [
        ['Caesar salad', 15.00],
        ['Tabbouleh', 12.00],
        ['Seasonal salad', 8.00],
        ['Shopska salad', 10.00],
        ['Caprese salad', 12.00],
        ['Avocado and mango salad', 18.00],
    ],

    'SENDVIČI / SANDWICHES': [
        ['Philly steak sandwich', 18.50],
        ['Falafel wrap', 13.00],
        ['Del Gusto smashed burger', 14.00],
        ['Crispy chicken sandwich', 13.00],
        ['Club sandwich', 15.00],
    ],

    'PIZZA & PIDE': [
        ['Mini pizza', 7.00],
        ['Margherita', 12.00],
        ['Capricciosa', 13.00],
        ['Mexicana', 14.00],
        ['Vegeteriana', 15.00],
        ['Zaatar Pide', 8.00],
        ['Cheese Pide', 10.00],
        ['Labneh & Honey Pide', 12.00],
        ['Meat & Cheese Pide', 14.00],
    ],

    'PASTA': [
        ['Chicken pasta with broccoli', 16.00],
        ['Spaghetti with chicken and mushrooms - ALFREDO', 14.00],
        ['Spaghetti with chicken and mushrooms - PESTO', 14.00],
        ['Spicy chicken pasta', 16.00],
        ["Chef's signature pasta", 20.00],
    ],

    'MAIN DISHES': [
        ['Veal schnitzel in natural sauce', 30.00],
        ['Del Gusto mixed grill', 35.00],
        ['Chicken wok', 14.00],
        ['Breaded chicken', 16.00],
        ['Chicken fillet with sauce', 15.00],
        ['Beef wok', 20.00],
    ],

    'STEAKS': [
        ['Rump steak', 35.00],
        ['Beefsteak', 55.00],
    ],

    'FISH': [
        ['Salmon Prestige', 30.00],
        ['Ocean Teriyaki Royal', 30.00],
        ['Shrimp with biryani rice', 28.00],
        ['Trout', 20.00],
    ],

    'DEL GUSTO PREMIUM': [
        ['Premium Del Gusto roasted veal', 30.00],
        ['Lamb Mandi', 45.00],
        ['Chicken Mandi', 25.00],
        ['Kofta skewers', 20.00],
        ['Chicken skewers', 18.00],
        ['Veal skewers', 24.00],
        ['Del Gusto premium mixed grill (for 4 persons)', 120.00],
    ],

    'KIDS MENU': [
        ['Mini chicken burger', 12.00],
        ['Chicken fingers', 11.00],
        ['Crispy wings', 14.00],
    ],

    'SIDE DISH': [
        ['Grilled vegetables', 8.00],
        ['Ketchup', 1.00],
        ['Ajvar', 1.00],
        ['Mandi rice', 10.00],
        ['Hummus', 6.00],
        ['Roasted potatoes', 6.00],
        ['Cucumber sauce', 6.00],
        ['Mustard', 1.00],
        ['Sour cream', 1.00],
        ['Homemade Del Gusto bread', 1.00],
        ['French fries', 4.00],
    ],

    'DESSERTS': [
        ['Pancakes', 8.00],
        ['Realistic cakes', 12.00],
        ['Oreo cake', 9.00],
        ['Honey cake', 8.00],
        ['Raspberry cake', 8.00],
        ['Baklava', 9.00],
        ['Waffles', 9.00],
        ['Chocolate baklava', 9.00],
        ['San Sebastián cheesecake', 9.00],
    ],

    'SPECIALITY COFFEE': [
        ['Bonbon coffee', 6.00],
        ['Small macchiato', 3.50],
        ['Hot Oreo coffee', 7.00],
        ['Espresso', 3.00],
        ['Large macchiato', 4.00],
        ['Cappuccino', 4.00],
        ['Special macchiato', 6.00],
        ['Dalgona coffee', 7.00],
        ['Café Latte', 5.00],
        ['Spanish latte', 7.00],
        ['Americano', 4.00],
        ['Café mocha', 7.00],
        ['Nutella coffee', 7.00],
        ['Matcha', 8.00],
        ['Hot chocolate with marshmallows', 7.00],
        ['Pistachio Matcha', 10.00],
        ['Pistachio latte', 8.00],
        ['Nescafé vanilla or chocolate', 6.00],
        ['Mixed hot chocolate', 10.00],
        ['V60 coffee', 12.00],
        ['Bosnian coffee', 5.50],
    ],

    'ICED COFFEE': [
        ['Iced Spanish Latte', 10.00],
        ['Iced Mocha Coco', 9.00],
        ['Mocha frappe', 8.00],
        ['Nutella frappe', 10.00],
        ['Caramel sticky frappe', 8.00],
        ['Iced Latte', 6.00],
        ['Iced Caramel Latte', 9.00],
        ['Shaken White Mocha', 10.00],
        ['Iced Salted Caramel Latte', 9.00],
        ['Iced Strawberry Matcha', 10.00],
        ['Iced Caramel Matcha', 10.00],
    ],

    'MILKSHAKE': [
        ['Oreo milkshake', 10.00],
        ['Snickers milkshake', 14.00],
        ['Blueberry milkshake', 10.00],
        ['Banana milkshake', 9.00],
        ['Vanilla milkshake', 9.00],
    ],

    'FRESH JUICES': [
        ['Peach juice', 8.00],
        ['Lemonade', 5.00],
        ['Kiwi juice', 8.00],
        ['Lemon mint juice', 9.00],
        ['Pink lemonade', 9.00],
        ['Watermelon juice', 9.00],
        ['Pineapple', 10.00],
        ['Orange juice', 7.50],
    ],

    'SOFT DRINKS': [
        ['Cappy', 4.00],
        ['Coca cola', 4.00],
        ['Coca cola Zero', 4.00],
        ['Fanta', 4.00],
        ['Schweppes', 4.00],
        ['Sprite', 4.00],
        ['Cockta', 4.00],
        ['Orangina', 5.00],
        ['Red Bull', 6.00],
        ['Homemade ice tea', 6.00],
        ['Ice tea forestfruit', 8.00],
        ['Ice tea strawberry', 8.00],
    ],

    'DRINKS': [
        ['Water 0,33l', 3.00],
        ['Water 0,75l', 6.00],
        ['Sparkling water 0,33l', 3.00],
        ['Sparkling water 0,75l', 8.00],
        ['Tea', 4.00],
    ],

    'COCKTAILS & MOCKTAILS': [
        ['Piña Colada', 11.00],
        ['Elderflower & Berries', 12.00],
        ['Strawberry Mojito', 10.00],
        ['Del Gusto Mojito', 14.00],
        ['Blue Sky Mojito', 10.00],
        ['Blueberry Mojito', 10.00],
        ['Passion fruit Mojito', 10.00],
        ['Classic Mojito', 8.00],
        ['Tropical Mojito', 10.00],
        ['Green Mix Mojito', 10.00],
        ['Red Sea Mojito', 12.00],
    ],
};


async function main() {

    // Pronalazimo samo DEL GUSTO tenant
    const restaurant = await prisma.restaurant.findUnique({
        where: {
            slug: 'del-gusto'
        }
    });

    if (!restaurant) {
        throw new Error(
            'Del Gusto restoran nije pronađen u bazi. Očekivani slug: del-gusto'
        );
    }

    console.log('');
    console.log('====================================');
    console.log(' DEL GUSTO MENU IMPORT');
    console.log('====================================');
    console.log('');
    console.log(`Restoran: ${restaurant.name}`);
    console.log(`Restaurant ID: ${restaurant.id}`);
    console.log('');

    console.log('Brišem postojeći Del Gusto meni...');

    await prisma.menuItem.deleteMany({
        where: {
            restaurantId: restaurant.id
        }
    });

    await prisma.menuCategory.deleteMany({
        where: {
            restaurantId: restaurant.id
        }
    });

    console.log('Stari meni obrisan.');
    console.log('');
    console.log('Ubacujem novi meni...');
    console.log('');

    let categoryOrder = 0;

    for (const [categoryName, items] of Object.entries(menu)) {

        const category = await prisma.menuCategory.create({
            data: {
                restaurantId: restaurant.id,
                name: categoryName,
                sortOrder: categoryOrder,
                visible: true
            }
        });

        categoryOrder++;

        await prisma.menuItem.createMany({
            data: items.map(([name, price], index) => ({
                restaurantId: restaurant.id,
                categoryId: category.id,
                name: name,
                price: price,
                visible: true,
                sortOrder: index
            }))
        });

        console.log(`✓ ${categoryName} — ${items.length} artikala`);
    }

    const totalItems = Object.values(menu)
        .reduce((total, items) => total + items.length, 0);

    console.log('');
    console.log('====================================');
    console.log(' IMPORT USPJEŠNO ZAVRŠEN');
    console.log('====================================');
    console.log('');
    console.log(`Kategorija: ${Object.keys(menu).length}`);
    console.log(`Artikala: ${totalItems}`);
    console.log('');
    console.log('Refreshaj CRM i javni web.');
    console.log('');
}

main()
    .catch((error) => {

        console.error('');
        console.error('IMPORT NIJE USPIO');
        console.error('');
        console.error(error);

        process.exit(1);
    })
    .finally(async () => {

        await prisma.$disconnect();
    });