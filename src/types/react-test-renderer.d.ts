/**
 * Minimal local typings for `react-test-renderer`.
 *
 * The upstream `@types/react-test-renderer` package isn't installed (and the
 * renderer ships no types of its own), so we declare just the slice the
 * design tests use: `create`, `act`, and the `TestInstance` query surface.
 */
declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  export interface TestInstance {
    type: unknown;
    props: { [key: string]: any };
    parent: TestInstance | null;
    children: (TestInstance | string)[];
    find(predicate: (node: TestInstance) => boolean): TestInstance;
    findAll(predicate: (node: TestInstance) => boolean): TestInstance[];
    findByType(type: unknown): TestInstance;
    findAllByType(type: unknown): TestInstance[];
    findByProps(props: { [key: string]: unknown }): TestInstance;
    findAllByProps(props: { [key: string]: unknown }): TestInstance[];
  }

  export interface ReactTestRenderer {
    root: TestInstance;
    toJSON(): unknown;
    update(element: ReactElement): void;
    unmount(): void;
  }

  export function create(element: ReactElement, options?: unknown): ReactTestRenderer;
  export function act(callback: () => void | Promise<void>): Promise<void> & { then?: never };

  const TestRenderer: {
    create: typeof create;
    act: typeof act;
  };
  export default TestRenderer;
}
