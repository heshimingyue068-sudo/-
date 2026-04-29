import { db } from './firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';

export async function seedDatabase(userId?: string) {
  const batch = writeBatch(db);

  // 1. Categories
  const categories = [
    { id: 'phone', name: '话费卡', icon: '📱', order: 1 },
    { id: 'ecommerce', name: '电商卡', icon: '📦', order: 2 },
    { id: 'supermarket', name: '商超卡', icon: '🛒', order: 3 },
    { id: 'gas', name: '加油卡', icon: '⛽', order: 4 },
    { id: 'game', name: '游戏卡', icon: '🎮', order: 5 },
    { id: 'food', name: '美食券', icon: '🍕', order: 6 },
    { id: 'movie', name: '影音券', icon: '🎬', order: 7 },
    { id: 'travel', name: '出行券', icon: '🚗', order: 8 },
  ];

  for (const cat of categories) {
    const ref = doc(db, 'categories', cat.id);
    batch.set(ref, cat);
  }

  // 2. Brands
  const brands = [
    { 
      id: 'liantong', 
      name: '联通充值卡', 
      categoryId: 'phone', 
      logo: 'https://img.icons8.com/color/144/china-unicom.png',
      highestRate: 0.985,
      supportTypes: ['card_password'],
    },
    { 
      id: 'yidong', 
      name: '移动充值卡', 
      categoryId: 'phone', 
      logo: 'https://img.icons8.com/color/144/china-mobile.png',
      highestRate: 0.982,
      supportTypes: ['card_password'],
    },
    { 
      id: 'dianxin', 
      name: '电信充值卡', 
      categoryId: 'phone', 
      logo: 'https://img.icons8.com/color/144/china-telecom.png',
      highestRate: 0.98,
      supportTypes: ['card_password'],
    },
    { 
      id: 'jd_ecard', 
      name: '京东E卡', 
      categoryId: 'ecommerce', 
      logo: 'https://img11.360buyimg.com/n1/jfs/t1/181604/23/15136/839/60ffcaeaEff3dd292/3d8e57608f654b0c.png',
      highestRate: 0.94,
      supportTypes: ['card_password'],
    },
    { 
      id: 'starbucks', 
      name: '星巴克', 
      categoryId: 'food', 
      logo: 'https://v.starbucks.com.cn/images/logo.png',
      highestRate: 0.88,
      supportTypes: ['card_password', 'qr_code'],
    }
  ];

  for (const brand of brands) {
    const ref = doc(db, 'brands', brand.id);
    batch.set(ref, brand);
  }

  // 3. Configs (Prices)
  const configs = [
    { id: 'sb_10', brandId: 'starbucks', faceValue: 10, fastRate: 0.88, slowRate: 0.92, isActive: true },
    { id: 'sb_20', brandId: 'starbucks', faceValue: 20, fastRate: 0.88, slowRate: 0.92, isActive: true },
    { id: 'sb_30', brandId: 'starbucks', faceValue: 30, fastRate: 0.88, slowRate: 0.92, isActive: true },
    { id: 'sb_40', brandId: 'starbucks', faceValue: 40, fastRate: 0.88, slowRate: 0.92, isActive: true },
    { id: 'sb_50', brandId: 'starbucks', faceValue: 50, fastRate: 0.88, slowRate: 0.92, isActive: true },
    { id: 'sb_100', brandId: 'starbucks', faceValue: 100, fastRate: 0.90, slowRate: 0.94, isActive: true },
    { id: 'luckin_20', brandId: 'luckin', faceValue: 20, fastRate: 0.75, slowRate: 0.80, isActive: true },
    { id: 'jd_100', brandId: 'jd_ecard', faceValue: 100, fastRate: 0.94, slowRate: 0.96, isActive: true },
    { id: 'wm_100', brandId: 'walmart', faceValue: 100, fastRate: 0.95, slowRate: 0.98, isActive: true },
    { id: 'iqiyi_year', brandId: 'iqiyi', faceValue: 248, fastRate: 0.60, slowRate: 0.65, isActive: true },
  ];

  for (const config of configs) {
    const ref = doc(db, 'configs', config.id);
    batch.set(ref, config);
  }

  if (userId) {
    // Add some sample orders
    const sampleOrders = [
      {
        userId,
        brandId: 'starbucks',
        brandName: '星巴克',
        faceValue: 100,
        expectedAmount: 90,
        status: 'completed',
        createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(), // 2 days ago
      },
      {
        userId,
        brandId: 'jd_ecard',
        brandName: '京东E卡',
        faceValue: 200,
        expectedAmount: 188,
        status: 'completed',
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString(), // 5 hours ago
      },
      {
        userId,
        brandId: 'liantong',
        brandName: '联通充值卡',
        faceValue: 50,
        expectedAmount: 49,
        status: 'consignment',
        createdAt: new Date().toISOString(),
      }
    ];

    for (const order of sampleOrders) {
      const ref = doc(collection(db, 'orders'));
      batch.set(ref, order);
      
      // If completed, add as transaction
      if (order.status === 'completed') {
        const tRef = doc(collection(db, 'transactions'));
        batch.set(tRef, {
          userId,
          amount: order.expectedAmount,
          type: 'income',
          description: `订单结算: ${order.brandName}`,
          sourceId: ref.id,
          status: 'completed',
          createdAt: order.createdAt
        });
      }
    }

    // Add explicit expenditure data
    const sampleExpenses = [
      {
        userId,
        amount: 3.00,
        type: 'expenditure',
        description: '扫经营码付款-给陶勇',
        status: 'completed',
        createdAt: new Date(Date.now() - 3600000 * 1).toISOString()
      },
      {
        userId,
        amount: 22.00,
        type: 'expenditure',
        description: '波哥擀面皮羊肉汤',
        status: 'completed',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        userId,
        amount: 7.00,
        type: 'expenditure',
        description: '巴比手工鲜肉包',
        status: 'completed',
        createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
      },
      {
        userId,
        amount: 50.00,
        type: 'expenditure',
        description: '提现至支付宝',
        status: 'completed',
        createdAt: new Date(Date.now() - 3600000 * 48).toISOString()
      },
      {
        userId,
        amount: 0.39,
        type: 'income',
        description: '余额宝-收益发放',
        status: 'completed',
        createdAt: new Date(Date.now() - 3600000 * 6).toISOString()
      },
      {
        userId,
        amount: 45.00,
        type: 'income',
        description: '订单结算: 必胜客',
        status: 'completed',
        createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
      }
    ];

    for (const exp of sampleExpenses) {
      const ref = doc(collection(db, 'transactions'));
      batch.set(ref, exp);
    }
  }

  await batch.commit();
}
