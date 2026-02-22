const fs = require('fs');
const path = 'frontend/admin-panel.html';
let c = fs.readFileSync(path, 'utf8');

// Find the id="alertas-dai" section start
// Look backwards from that tag to the comment that precedes it
const tagIdx = c.indexOf('id="alertas-dai"');
if (tagIdx === -1) { console.error('alertas-dai id not found'); process.exit(1); }

// Go back to find the start of the comment block (or the tab-content div)
// We scan backwards for <!-- 
let commentStart = tagIdx;
while (commentStart > 0 && c[commentStart] !== '<') commentStart--;
// Go further back to include the comment
const commentSearch = c.lastIndexOf('<!--', tagIdx);
if (commentSearch !== -1 && tagIdx - commentSearch < 200) {
    commentStart = commentSearch;
}

console.log('section starts at char:', commentStart);
console.log('preview:', JSON.stringify(c.slice(commentStart, commentStart + 80)));

// Find the end — look for the closing pattern after the section
const endMarker = '</div><!-- /#alertas-dai -->';
const eIdx = c.indexOf(endMarker, tagIdx);
if (eIdx === -1) {
    // try alternate
    console.log('Trying alternate end marker...');
    // maybe it was changed; look for the next tab-content div section id after alertas-dai
    const auditStart = c.indexOf('id="audit"', tagIdx);
    console.log('audit section at:', auditStart);
    // The closing of alertas-dai div will be before the audit section comment
    const prevComment = c.lastIndexOf('<!--', auditStart);
    const closeDiv = c.lastIndexOf('</div>', prevComment);
    console.log('closeDiv at:', closeDiv);
    console.log('around closeDiv:', JSON.stringify(c.slice(closeDiv - 20, closeDiv + 40)));
    process.exit(1);
}
console.log('section ends at char:', eIdx + endMarker.length);
console.log('DONE - markers found OK');
