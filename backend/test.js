const ammService = require('./src/services/ammService');

function runTest(name, fn) {
  console.log(`\n===== ${name} =====`);
  try {
    const result = fn();
    console.log(result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

runTest('getPool()', () => ammService.getPool());
runTest('getConstantProduct()', () => ammService.getConstantProduct());
runTest('getSpotPrice()', () => ammService.getSpotPrice());
runTest('quoteBuy(100)', () => ammService.quoteBuy(100));

console.log('\n✅ All manual tests completed.');
