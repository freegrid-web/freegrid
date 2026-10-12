// Mobile specs stay excluded, as upstream did. Filter specs with Jasmine's `?spec=` URL parameter.
import.meta.glob(['./**/*.spec.js', '!./mobile/**'], { eager: true });
import.meta.glob('../../src/plugins/**/*.e2e.js', { eager: true });
import './MemoryLeakTest';
