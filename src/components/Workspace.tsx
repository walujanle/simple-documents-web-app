import { DocProvider } from '@/components/DocContext';
import Editor from '@/components/Editor';
import Navbar from '@/components/Navbar';
import Settings from '@/components/Settings';
import Sidebar from '@/components/Sidebar';

interface WorkspaceProps {
  activeDocId?: string;
  mode?: 'editor' | 'settings';
}

export default function Workspace({ activeDocId, mode = 'editor' }: WorkspaceProps) {
  return (
    <DocProvider activeDocId={activeDocId}>
      <div className="flex h-screen overflow-hidden bg-bg-app">
        <Sidebar />
        <div className="grow flex flex-col min-w-0 h-full relative overflow-hidden">
          {mode === 'settings' ? (
            <div className="grow overflow-y-auto h-full">
              <Settings />
            </div>
          ) : (
            <>
              <Navbar />
              <Editor />
            </>
          )}
        </div>
      </div>
    </DocProvider>
  );
}
