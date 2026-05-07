import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, getDocs, limit, query } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const configPath = resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
  console.log("Seeding 5 approval items...");
  
  // Try to find a user
  const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
  let userId = 'system_test_user';
  if (!usersSnap.empty) {
    userId = usersSnap.docs[0].id;
    console.log("Using existing user:", userId);
  } else {
    console.log("No users found, using dummy ID");
  }

  const brands = ['星巴克 Starbucks', '瑞幸咖啡 Luckin', '肯德基 KFC', '必胜客 PizzaHut', '麦当劳 McDonald'];
  const skuNames = ['100元代金券', '50元通用券', '30元饮品券', '200元家庭套餐', '80元双人餐'];
  
  for (let i = 0; i < 5; i++) {
    const orderData = {
      userId: userId,
      brandName: brands[i],
      couponType: 'card_password',
      faceValue: 100,
      expectedAmount: 95,
      status: 'settling',
      pendingSettlement: true,
      speed: 'fast',
      createdAt: new Date(Date.now() - i * 3600000).toISOString(),
      cards: [
        {
          id: `card_${Date.now()}_${i}`,
          cardNo: `${6222000000000000 + i}`,
          cardPwd: `${Math.floor(Math.random() * 1000000)}`,
          status: 'settling',
          settlementStatus: 'pending',
          skuName: skuNames[i],
          phone: `13${i}00000000`,
          location: i % 2 === 0 ? '北京' : '上海',
          claimTime: '2024-05-01 12:00',
          usageTime: '2024-05-01 14:00',
          amount: 95
        }
      ]
    };
    
    await addDoc(collection(db, 'orders'), orderData);
    console.log(`Added order ${i+1}: ${brands[i]}`);
  }
  
  console.log("Seeding complete.");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
