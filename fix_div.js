const fs = require('fs');
let content = fs.readFileSync('src/app/profile/page.tsx', 'utf8');

// The string `Distribute your invite code to start earning.\n                      </span>\n                    </div>\n                  )}\n                </div>\n              </div>\n            </div>`
// needs one more `</div>` appended to it!

content = content.replace(
  "                  )}\n                </div>\n              </div>\n            </div>\n\n          {/* Degen Quote at bottom */}",
  "                  )}\n                </div>\n              </div>\n            </div>\n          </div>\n\n          {/* Degen Quote at bottom */}"
);

fs.writeFileSync('src/app/profile/page.tsx', content);
console.log("Appended missing </div>!");
