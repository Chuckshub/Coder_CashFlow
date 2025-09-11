import { collection, addDoc, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export const testFirebaseConnection = async (userId: string) => {
  console.log('🧪 Testing Firebase connection and permissions...');
  
  try {
    // Test 1: Basic connection
    console.log('🔥 Firebase db instance:', !!db);
    
    // Test 2: Simple document write to test collection
    const testCollectionRef = collection(db, 'test');
    console.log('📝 Testing basic write to /test collection...');
    
    const testDoc = await addDoc(testCollectionRef, {
      message: 'Firebase test',
      timestamp: new Date(),
      userId
    });
    console.log('✅ Test write successful, doc ID:', testDoc.id);
    
    // Test 3: Read back the test document
    console.log('📖 Testing read from /test collection...');
    const testQuery = await getDocs(testCollectionRef);
    console.log('✅ Test read successful, found', testQuery.size, 'documents');
    
    // Test 4: Write to user-specific collection (the actual path we use)
    const userTransactionsPath = `users/${userId}/transactions`;
    console.log('📝 Testing write to user collection:', userTransactionsPath);
    
    const userCollectionRef = collection(db, 'users', userId, 'transactions');
    const userTestDoc = {
      id: 'test-transaction-123',
      description: 'Test transaction',
      amount: 100,
      type: 'test',
      date: new Date().toISOString(),
      userId
    };
    
    const userDocRef = doc(userCollectionRef, 'test-transaction-123');
    await setDoc(userDocRef, userTestDoc);
    console.log('✅ User collection write successful');
    
    // Test 5: Read back from user collection
    console.log('📖 Testing read from user collection...');
    const userQuery = await getDocs(userCollectionRef);
    console.log('✅ User collection read successful, found', userQuery.size, 'documents');
    
    // List document IDs in user collection
    const docIds: string[] = [];
    userQuery.forEach(doc => {
      docIds.push(doc.id);
      console.log('📄 Found doc ID:', doc.id, 'Data keys:', Object.keys(doc.data()));
    });
    
    console.log('🎉 All Firebase tests passed!');
    return {
      success: true,
      testDocId: testDoc.id,
      userCollectionSize: userQuery.size,
      userDocIds: docIds
    };
    
  } catch (error) {
    console.error('💥 Firebase test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export const testFirebaseRules = async () => {
  console.log('🛡️ Testing Firestore security rules...');
  
  try {
    // Try to write to root collection (should work if rules allow)
    const rootRef = collection(db, 'public-test');
    await addDoc(rootRef, { test: true, timestamp: new Date() });
    console.log('✅ Root collection write allowed');
    return true;
  } catch (error) {
    console.error('❌ Root collection write denied:', error);
    return false;
  }
};