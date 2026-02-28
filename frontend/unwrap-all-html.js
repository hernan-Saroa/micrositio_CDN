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
        // Un-wrap: replace window.safeHTML(X) with X for ALL innerHTML assignments
        path.node.right = path.node.right.arguments[0];
    });

    return root.toSource();
}
