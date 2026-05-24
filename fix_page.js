const fs = require('fs');
let content = fs.readFileSync('src/app/profile/page.tsx', 'utf8');

// The missing characters were ')}' before the first '</div>' in referralModule
content = content.replace(
  "          </div>\n\n          {/* 5. TRENCH REFERRAL HQ */}",
  ")}\n          </div>\n\n          {/* 5. TRENCH REFERRAL HQ */}"
);

// Let's also fix the literal window.location.origin
content = content.replace(
  "                      ${typeof window !== 'undefined' ? window.location.origin : ''}/rooms?ref={user.referralCode}",
  "                      {typeof window !== 'undefined' ? window.location.origin : ''}/rooms?ref={user?.referralCode}"
);

fs.writeFileSync('src/app/profile/page.tsx', content);
console.log("Fixed page.tsx syntax!");
