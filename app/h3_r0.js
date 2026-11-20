// h3, круг 0: основа (combo4 + фитили, combo4) — цифры для сравнения
const H = require('./h3_lib.js');
H.base('wick');
H.run('combo4 + фитили (основа)', H.S57, H.polW, { n100: true });
H.run('combo4 (к основе фитилей)', H.S57, H.polC, { n100: true });
H.base('c4');
H.run('combo4 (основа c4)', H.S57, H.polC, { n100: true });
H.run('combo4 + фитили (к c4)', H.S57, H.polW, { n100: true });
