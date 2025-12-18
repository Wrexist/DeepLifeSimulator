/**
 * Polyfill for Array.prototype.toReversed() for Node.js < 20
 * This is required because Metro config uses toReversed() which requires Node 20+
 * 
 * This script patches Array.prototype if toReversed doesn't exist
 */

if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function() {
    return [...this].reverse();
  };
  
  console.log('✅ Applied toReversed() polyfill');
}

