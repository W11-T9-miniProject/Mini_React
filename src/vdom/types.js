/**
 * @typedef {{ type: 'text', value: string }} VText
 * @typedef {{ type: 'element', tag: string, props: Record<string, string>, children: VNode[] }} VElement
 * @typedef {VText | VElement} VNode
 * @typedef {number[]} NodePath childNodes 기준 경로. []는 루트.
 * @typedef {{ type: 'TEXT', path: NodePath, value: string }
 * | { type: 'PROPS', path: NodePath, set: Record<string, string>, remove: string[] }
 * | { type: 'REPLACE', path: NodePath, node: VNode }
 * | { type: 'INSERT', path: NodePath, index: number, node: VNode }
 * | { type: 'REMOVE', path: NodePath }} Patch
 * INSERT의 path는 부모 경로이며 index는 다음 children 배열 기준이다.
 */
export {};
