import React from 'react';
import { BookOpen } from 'lucide-react';

const CodeCatalog: React.FC = () => (
  <div className="p-8 text-center">
    <BookOpen size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
    <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300">Code Catalog</h2>
    <p className="text-slate-500 dark:text-slate-400 mt-2">Coming soon</p>
  </div>
);

export default CodeCatalog;
