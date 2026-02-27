module.exports = function (fileInfo, api) {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);

    // find all AssignmentExpressions
    root.find(j.AssignmentExpression, { operator: '=' })
        .filter(path => {
            // check if left side is a MemberExpression ending in 'innerHTML'
            const left = path.node.left;
            return left.type === 'MemberExpression' &&
                left.property.type === 'Identifier' &&
                left.property.name === 'innerHTML';
        })
        .forEach(path => {
            const right = path.node.right;

            // We only wrap TemplateLiterals or CallExpressions that look like returning HTML strings
            // If it's already wrapped in safeHTML, skip it
            if (right.type === 'CallExpression' &&
                right.callee.type === 'Identifier' &&
                right.callee.name === 'safeHTML') {
                return;
            }
            if (right.type === 'CallExpression' &&
                right.callee.type === 'MemberExpression' &&
                right.callee.property.name === 'safeHTML') {
                return;
            }

            // Create window.safeHTML( right )
            const safeHtmlCall = j.callExpression(
                j.memberExpression(
                    j.identifier('window'),
                    j.identifier('safeHTML')
                ),
                [right]
            );

            path.node.right = safeHtmlCall;
        });

    // also handle += operator
    root.find(j.AssignmentExpression, { operator: '+=' })
        .filter(path => {
            const left = path.node.left;
            return left.type === 'MemberExpression' &&
                left.property.type === 'Identifier' &&
                left.property.name === 'innerHTML';
        })
        .forEach(path => {
            const right = path.node.right;

            const safeHtmlCall = j.callExpression(
                j.memberExpression(
                    j.identifier('window'),
                    j.identifier('safeHTML')
                ),
                [right]
            );

            path.node.right = safeHtmlCall;
        });

    return root.toSource();
};
