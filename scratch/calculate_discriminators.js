const crypto = require('crypto');

function getDiscriminator(preimage) {
  const hash = crypto.createHash('sha256').update(preimage).digest();
  return Array.from(hash.slice(0, 8));
}

console.log('Instructions:');
console.log('list_position:', getDiscriminator('global:list_position'));
console.log('cancel_listing:', getDiscriminator('global:cancel_listing'));
console.log('buy_position:', getDiscriminator('global:buy_position'));

console.log('\nAccounts:');
console.log('Listing:', getDiscriminator('account:Listing'));

console.log('\nEvents:');
console.log('PositionListed:', getDiscriminator('event:PositionListed'));
console.log('PositionPurchased:', getDiscriminator('event:PositionPurchased'));
console.log('ListingCancelled:', getDiscriminator('event:ListingCancelled'));
