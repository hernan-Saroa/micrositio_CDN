export default function transformer(file, api) {
    const j = api.jscodeshift;
    const root = j(file.source);

    // Find all assignments to .innerHTML
    root.find(j.AssignmentExpression, {
        operator: '=',
        left: {
            type: 'MemberExpression',
            property: { type: 'Identifier', name: 'innerHTML' }
        },
        right: {
            type: 'CallExpression',
            callee: {
                type: 'MemberExpression',
                object: { type: 'Identifier', name: 'window' },
                property: { type: 'Identifier', name: 'safeHTML' }
            }
        }
    }).forEach(path => {
        // Enforce removal only if the variable name suggests a table element
        const leftName = path.node.left.object.name;
        const validNames = ['tbody', 'row', 'table', 'list', 'cells', 'departmentSelect', 'sectorSelect']; // include select options just in case
        
        // Also unwrap if it looks like a table assignment
        if (leftName && (leftName.includes('tbody') || leftName.includes('row') || leftName.includes('table') || leftName.includes('cells') || leftName === 'list')) {
            // Un-wrap: replace window.safeHTML(X) with X
            path.node.right = path.node.right.arguments[0];
        }
    });

    return root.toSource();
}
