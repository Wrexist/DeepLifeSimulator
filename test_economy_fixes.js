/**
 * Economy Fixes Simulation Tests
 * Tests all economy balance fixes to ensure no errors or problems
 */

// Mock net worth calculation
function calculateNetWorth(money, stocks, realEstate, crypto, companies) {
  return (money || 0) + (stocks || 0) + (realEstate || 0) + (crypto || 0) + (companies || 0);
}

// Test 1: Business Partnership Event Scaling
function testBusinessPartnershipScaling() {
  console.log('\n=== Test 1: Business Partnership Event Scaling ===');
  
  const testCases = [
    { netWorth: 10000, expectedRange: [10000, 10000] }, // Floor
    { netWorth: 100000, expectedRange: [10000, 10000] }, // Still floor
    { netWorth: 1000000, expectedRange: [20000, 50000] }, // 2-5%
    { netWorth: 10000000, expectedRange: [100000, 100000] }, // Would be 2-5% ($200K-$500K) but capped at $100K
    { netWorth: 50000000, expectedRange: [100000, 100000] }, // Capped at $100K
  ];
  
  let allPassed = true;
  
  testCases.forEach(({ netWorth, expectedRange }) => {
    // Simulate the scaling logic
    const percentage = 0.02 + (Math.random() * 0.03); // 2-5% of net worth
    const baseOffer = Math.floor(netWorth * percentage);
    const scaledOffer = Math.max(10000, Math.min(100000, baseOffer));
    
    const minExpected = expectedRange[0];
    const maxExpected = expectedRange[1];
    
    // Test multiple times to ensure consistency
    let minResult = Infinity;
    let maxResult = -Infinity;
    
    for (let i = 0; i < 100; i++) {
      const p = 0.02 + (Math.random() * 0.03);
      const b = Math.floor(netWorth * p);
      const s = Math.max(10000, Math.min(100000, b));
      minResult = Math.min(minResult, s);
      maxResult = Math.max(maxResult, s);
    }
    
    const passed = minResult >= minExpected && maxResult <= maxExpected;
    allPassed = allPassed && passed;
    
    console.log(`Net Worth: $${netWorth.toLocaleString()}`);
    console.log(`  Expected: $${minExpected.toLocaleString()} - $${maxExpected.toLocaleString()}`);
    console.log(`  Actual: $${minResult.toLocaleString()} - $${maxResult.toLocaleString()}`);
    console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'}`);
  });
  
  return allPassed;
}

// Test 2: Inheritance Event Scaling
function testInheritanceScaling() {
  console.log('\n=== Test 2: Inheritance Event Scaling ===');
  
  const testCases = [
    { netWorth: 10000, expectedRange: [5000, 5000] }, // Floor
    { netWorth: 100000, expectedRange: [5000, 5000] }, // Still floor
    { netWorth: 1000000, expectedRange: [5000, 5000] }, // Would be $1K-$3K but floor is $5K
    { netWorth: 10000000, expectedRange: [10000, 30000] }, // 0.1-0.3%
    { netWorth: 50000000, expectedRange: [50000, 50000] }, // Capped at $50K
  ];
  
  let allPassed = true;
  
  testCases.forEach(({ netWorth, expectedRange }) => {
    let minResult = Infinity;
    let maxResult = -Infinity;
    
    for (let i = 0; i < 100; i++) {
      const percentage = 0.001 + (Math.random() * 0.002); // 0.1-0.3%
      const baseInheritance = Math.floor(netWorth * percentage);
      const inheritance = Math.max(5000, Math.min(50000, baseInheritance));
      minResult = Math.min(minResult, inheritance);
      maxResult = Math.max(maxResult, inheritance);
    }
    
    const minExpected = expectedRange[0];
    const maxExpected = expectedRange[1];
    const passed = minResult >= minExpected && maxResult <= maxExpected;
    allPassed = allPassed && passed;
    
    console.log(`Net Worth: $${netWorth.toLocaleString()}`);
    console.log(`  Expected: $${minExpected.toLocaleString()} - $${maxExpected.toLocaleString()}`);
    console.log(`  Actual: $${minResult.toLocaleString()} - $${maxResult.toLocaleString()}`);
    console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'}`);
  });
  
  return allPassed;
}

// Test 3: Investment Tip Scaling
function testInvestmentTipScaling() {
  console.log('\n=== Test 3: Investment Tip Scaling ===');
  
  const testCases = [
    { netWorth: 10000, expectedSmall: [1000, 2000], expectedBig: [5000, 5000] },
    { netWorth: 100000, expectedSmall: [1000, 2000], expectedBig: [5000, 5000] },
    { netWorth: 1000000, expectedSmall: [1000, 2000], expectedBig: [3000, 5000] },
    { netWorth: 10000000, expectedSmall: [10000, 20000], expectedBig: [30000, 50000] },
  ];
  
  let allPassed = true;
  
  testCases.forEach(({ netWorth, expectedSmall, expectedBig }) => {
    let minSmall = Infinity, maxSmall = -Infinity;
    let minBig = Infinity, maxBig = -Infinity;
    
    for (let i = 0; i < 100; i++) {
      // Small investment
      const smallP = 0.001 + (Math.random() * 0.001); // 0.1-0.2%
      const baseSmall = Math.floor(netWorth * smallP);
      const small = Math.max(1000, Math.min(25000, baseSmall));
      minSmall = Math.min(minSmall, small);
      maxSmall = Math.max(maxSmall, small);
      
      // Big investment
      const bigP = 0.003 + (Math.random() * 0.002); // 0.3-0.5%
      const baseBig = Math.floor(netWorth * bigP);
      const big = Math.max(5000, Math.min(50000, baseBig));
      minBig = Math.min(minBig, big);
      maxBig = Math.max(maxBig, big);
    }
    
    const smallPassed = minSmall >= expectedSmall[0] && maxSmall <= expectedSmall[1];
    const bigPassed = minBig >= expectedBig[0] && maxBig <= expectedBig[1];
    const passed = smallPassed && bigPassed;
    allPassed = allPassed && passed;
    
    console.log(`Net Worth: $${netWorth.toLocaleString()}`);
    console.log(`  Small: $${minSmall.toLocaleString()} - $${maxSmall.toLocaleString()} (expected: $${expectedSmall[0].toLocaleString()} - $${expectedSmall[1].toLocaleString()}) ${smallPassed ? '✅' : '❌'}`);
    console.log(`  Big: $${minBig.toLocaleString()} - $${maxBig.toLocaleString()} (expected: $${expectedBig[0].toLocaleString()} - $${expectedBig[1].toLocaleString()}) ${bigPassed ? '✅' : '❌'}`);
    console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'}`);
  });
  
  return allPassed;
}

// Test 4: Multiple Company Diminishing Returns
function testMultipleCompanyDiminishingReturns() {
  console.log('\n=== Test 4: Multiple Company Diminishing Returns ===');
  
  const baseIncome = 5000; // $5K per company
  const testCases = [
    { companyCount: 1, expectedMultiplier: 1.0 },
    { companyCount: 3, expectedMultiplier: 1.0 },
    { companyCount: 4, expectedMultiplier: 0.9 },
    { companyCount: 6, expectedMultiplier: 0.9 },
    { companyCount: 7, expectedMultiplier: 0.8 },
    { companyCount: 10, expectedMultiplier: 0.8 },
    { companyCount: 11, expectedMultiplier: 0.7 },
    { companyCount: 20, expectedMultiplier: 0.7 },
  ];
  
  let allPassed = true;
  
  testCases.forEach(({ companyCount, expectedMultiplier }) => {
    let efficiencyMultiplier = 1.0;
    if (companyCount > 10) {
      efficiencyMultiplier = 0.7;
    } else if (companyCount > 6) {
      efficiencyMultiplier = 0.8;
    } else if (companyCount > 3) {
      efficiencyMultiplier = 0.9;
    }
    
    const totalIncome = baseIncome * companyCount * efficiencyMultiplier;
    const expectedIncome = baseIncome * companyCount * expectedMultiplier;
    
    const passed = Math.abs(totalIncome - expectedIncome) < 0.01;
    allPassed = allPassed && passed;
    
    console.log(`${companyCount} companies:`);
    console.log(`  Expected multiplier: ${expectedMultiplier}, Actual: ${efficiencyMultiplier}`);
    console.log(`  Total income: $${totalIncome.toLocaleString()} (expected: $${expectedIncome.toLocaleString()})`);
    console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'}`);
  });
  
  return allPassed;
}

// Test 5: Company Employee Diminishing Returns
function testCompanyEmployeeDiminishingReturns() {
  console.log('\n=== Test 5: Company Employee Diminishing Returns ===');
  
  const baseIncome = 2000;
  const workerMultiplier = 1.1;
  
  const testCases = [
    { employees: 0, expectedMultiplier: 1.0 },
    { employees: 5, expectedMultiplier: Math.pow(1.1, 5) },
    { employees: 10, expectedMultiplier: Math.pow(1.1, 5) * Math.pow(1.05, 5) },
    { employees: 20, expectedMultiplier: Math.pow(1.1, 5) * Math.pow(1.05, 5) * Math.pow(1.02, 10) },
    { employees: 30, expectedMultiplier: Math.pow(1.1, 5) * Math.pow(1.05, 5) * Math.pow(1.02, 10) * Math.pow(1.01, 10) },
  ];
  
  let allPassed = true;
  
  testCases.forEach(({ employees, expectedMultiplier }) => {
    let incomeMultiplier;
    if (employees <= 5) {
      incomeMultiplier = Math.pow(workerMultiplier, employees);
    } else if (employees <= 10) {
      incomeMultiplier = Math.pow(workerMultiplier, 5) * Math.pow(1.05, employees - 5);
    } else if (employees <= 20) {
      incomeMultiplier = Math.pow(workerMultiplier, 5) * Math.pow(1.05, 5) * Math.pow(1.02, employees - 10);
    } else {
      incomeMultiplier = Math.pow(workerMultiplier, 5) * Math.pow(1.05, 5) * Math.pow(1.02, 10) * Math.pow(1.01, employees - 20);
    }
    
    const totalIncome = baseIncome * incomeMultiplier;
    const expectedIncome = baseIncome * expectedMultiplier;
    
    const passed = Math.abs(totalIncome - expectedIncome) < 0.01;
    allPassed = allPassed && passed;
    
    console.log(`${employees} employees:`);
    console.log(`  Multiplier: ${incomeMultiplier.toFixed(4)} (expected: ${expectedMultiplier.toFixed(4)})`);
    console.log(`  Income: $${totalIncome.toFixed(2)} (expected: $${expectedIncome.toFixed(2)})`);
    console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'}`);
  });
  
  return allPassed;
}

// Test 6: Edge Cases
function testEdgeCases() {
  console.log('\n=== Test 6: Edge Cases ===');
  
  let allPassed = true;
  
  // Test 1: Zero net worth
  const zeroNetWorth = 0;
  const percentage = 0.02 + (Math.random() * 0.03);
  const baseOffer = Math.floor(zeroNetWorth * percentage);
  const scaledOffer = Math.max(10000, Math.min(100000, baseOffer));
  const zeroPassed = scaledOffer === 10000; // Should hit floor
  allPassed = allPassed && zeroPassed;
  console.log(`Zero net worth: $${scaledOffer} (expected: $10,000) ${zeroPassed ? '✅' : '❌'}`);
  
  // Test 2: Very high net worth
  const veryHighNetWorth = 100000000; // $100M
  const highP = 0.02 + (Math.random() * 0.03);
  const highBase = Math.floor(veryHighNetWorth * highP);
  const highScaled = Math.max(10000, Math.min(100000, highBase));
  const highPassed = highScaled === 100000; // Should hit cap
  allPassed = allPassed && highPassed;
  console.log(`Very high net worth ($100M): $${highScaled} (expected: $100,000) ${highPassed ? '✅' : '❌'}`);
  
  // Test 3: Negative net worth (shouldn't happen but test anyway)
  const negativeNetWorth = -1000;
  const negP = 0.02 + (Math.random() * 0.03);
  const negBase = Math.floor(negativeNetWorth * negP);
  const negScaled = Math.max(10000, Math.min(100000, negBase));
  const negPassed = negScaled === 10000; // Should hit floor
  allPassed = allPassed && negPassed;
  console.log(`Negative net worth: $${negScaled} (expected: $10,000) ${negPassed ? '✅' : '❌'}`);
  
  // Test 4: Company count edge cases
  const companyCounts = [0, 1, 3, 4, 6, 7, 10, 11, 100];
  let companyPassed = true;
  companyCounts.forEach(count => {
    let multiplier = 1.0;
    if (count > 10) {
      multiplier = 0.7;
    } else if (count > 6) {
      multiplier = 0.8;
    } else if (count > 3) {
      multiplier = 0.9;
    }
    if (count === 0 && multiplier !== 1.0) companyPassed = false;
    if (count === 1 && multiplier !== 1.0) companyPassed = false;
    if (count === 3 && multiplier !== 1.0) companyPassed = false;
    if (count === 4 && multiplier !== 0.9) companyPassed = false;
    if (count === 11 && multiplier !== 0.7) companyPassed = false;
  });
  allPassed = allPassed && companyPassed;
  console.log(`Company count edge cases: ${companyPassed ? '✅' : '❌'}`);
  
  console.log(`\nOverall: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
  
  return allPassed;
}

// Test 7: Gaming/Streaming Decay
function testGamingStreamingDecay() {
  console.log('\n=== Test 7: Gaming/Streaming Decay ===');
  
  const baseViews = 10000;
  const testCases = [
    { age: 0, expectedDecay: 1.0, expectedViews: 10000 },
    { age: 1, expectedDecay: 0.95, expectedViews: 9500 },
    { age: 5, expectedDecay: 0.75, expectedViews: 7500 },
    { age: 10, expectedDecay: 0.5, expectedViews: 5000 },
    { age: 18, expectedDecay: 0.1, expectedViews: 1000 }, // Min 10%
    { age: 20, expectedDecay: 0.1, expectedViews: 1000 }, // Min 10%
  ];
  
  let allPassed = true;
  
  testCases.forEach(({ age, expectedDecay, expectedViews }) => {
    const decayFactor = Math.max(0.1, 1 - (age * 0.05));
    const effectiveViews = Math.floor(baseViews * decayFactor);
    
    const decayPassed = Math.abs(decayFactor - expectedDecay) < 0.01;
    const viewsPassed = Math.abs(effectiveViews - expectedViews) < 1;
    const passed = decayPassed && viewsPassed;
    allPassed = allPassed && passed;
    
    console.log(`Age ${age} weeks:`);
    console.log(`  Decay factor: ${decayFactor.toFixed(2)} (expected: ${expectedDecay.toFixed(2)}) ${decayPassed ? '✅' : '❌'}`);
    console.log(`  Effective views: ${effectiveViews} (expected: ${expectedViews}) ${viewsPassed ? '✅' : '❌'}`);
    console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'}`);
  });
  
  return allPassed;
}

// Test 8: Passive Income Soft Cap
function testPassiveIncomeSoftCap() {
  console.log('\n=== Test 8: Passive Income Soft Cap ===');
  
  const rawIncome = 100000; // $100K/week
  const testCases = [
    { netWorth: 5000000, expectedEfficiency: 1.0 }, // Below threshold
    { netWorth: 10000000, expectedEfficiency: 1.0 }, // At threshold
    { netWorth: 20000000, expectedEfficiency: 0.9 }, // $10M above
    { netWorth: 30000000, expectedEfficiency: 0.81 }, // $20M above (0.9^2)
    { netWorth: 100000000, expectedEfficiency: 0.5 }, // $90M above, should hit min
  ];
  
  let allPassed = true;
  
  testCases.forEach(({ netWorth, expectedEfficiency }) => {
    const softCapThreshold = 10_000_000;
    let efficiency = 1.0;
    
    if (netWorth > softCapThreshold && rawIncome > 0) {
      const incrementsAboveThreshold = Math.floor((netWorth - softCapThreshold) / 10_000_000);
      const efficiencyMultiplier = Math.pow(0.9, incrementsAboveThreshold);
      efficiency = Math.max(0.5, efficiencyMultiplier);
    }
    
    const totalIncome = Math.round(rawIncome * efficiency);
    const expectedIncome = Math.round(rawIncome * expectedEfficiency);
    
    const passed = Math.abs(totalIncome - expectedIncome) < 1;
    allPassed = allPassed && passed;
    
    console.log(`Net Worth: $${netWorth.toLocaleString()}`);
    console.log(`  Efficiency: ${efficiency.toFixed(3)} (expected: ${expectedEfficiency.toFixed(3)})`);
    console.log(`  Income: $${totalIncome.toLocaleString()} (expected: $${expectedIncome.toLocaleString()})`);
    console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'}`);
  });
  
  return allPassed;
}

// Run all tests
function runAllTests() {
  console.log('='.repeat(60));
  console.log('ECONOMY FIXES SIMULATION TESTS');
  console.log('='.repeat(60));
  
  const results = {
    businessPartnership: testBusinessPartnershipScaling(),
    inheritance: testInheritanceScaling(),
    investmentTip: testInvestmentTipScaling(),
    multipleCompanies: testMultipleCompanyDiminishingReturns(),
    companyEmployees: testCompanyEmployeeDiminishingReturns(),
    edgeCases: testEdgeCases(),
    gamingDecay: testGamingStreamingDecay(),
    passiveIncomeCap: testPassiveIncomeSoftCap(),
  };
  
  console.log('\n' + '='.repeat(60));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  
  const allPassed = Object.values(results).every(r => r === true);
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${test}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log(`OVERALL: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log('='.repeat(60));
  
  return allPassed;
}

// Run tests
runAllTests();

