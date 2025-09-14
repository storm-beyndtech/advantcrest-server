import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Import existing models
import { Trader } from './models/trader.js';
import { Util } from './models/util.js';

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('Connected to MongoDB for seeding...');

    // Trader data
    const traderData = []

    // Utils/Coins data
    const utilsData = {
      _id: "6593e3525531a494b5b32547",
      coins: [
        {
          name: "bitcoin",
          address: "bc1ql7336xkyu57v3z5y490hl0fty9gjrhqt26sy8c",
          network: "BTC",
          price: 109400,
          _id: "6593e3525531a494b5b32548"
        },
        {
          name: "Usdt",
          address: "0x80a723966216eba0b663eabae0f5bcd51d433831",
          network: "BEP20 ",
          price: 1,
          _id: "67683e1585fa55be01c15f9b"
        },
        {
          name: "EThereum ",
          address: "0x80a723966216eba0b663eabae0f5bcd51d433831",
          network: "ETH",
          price: 2501,
          _id: "683502a75c259adaafa38e4f"
        },
        {
          name: "Usdt",
          address: "TD1HEKC1eTr28LeLYtTUkNbrJdLVwLppPu",
          network: "TRC20",
          price: 1,
          _id: "683502a75c259adaafa38e50"
        },
        {
          name: "Solana",
          address: "HrQCAhTChqjdFRXKJXKJN1jgCzCSKJLuQqkDEmsuUh7K",
          network: "SOL",
          price: 2,
          _id: "683502a75c259adaafa38e51"
        },
        {
          name: "Xrp",
          address: "rP9yx1u9Na",
          network: "XRP",
          price: 0.5,
          _id: "683502a75c259adaafa38e52"
        }
      ]
    };

    // Seed trader (replace if exists)
    await Trader.findByIdAndDelete(traderData._id);
    const trader = new Trader(traderData);
    await trader.save();
    console.log('✅ Trader seeded:', trader.name, `(${trader.username})`);

    // Seed utils/coins (replace if exists)
    await Util.findByIdAndDelete(utilsData._id);
    const utils = new Util(utilsData);
    await utils.save();
    console.log('✅ Utils/Coins seeded:', utils.coins.length, 'coins');

    console.log('\n🎉 All data seeded successfully!');
    console.log('Trader:', traderData.name);
    console.log('Coins:', utilsData.coins.map(c => c.name).join(', '));

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

seedData();