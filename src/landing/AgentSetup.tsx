import { useState } from 'react';
import { Command } from './Command';
import { REPO_DIR, REPO_URL } from './config';

type AgentId = 'claude' | 'codex' | 'cursor' | 'other';

const AGENTS: { id: AgentId; name: string; reads: string; open: { lines?: string[]; text?: string } }[] = [
  { id: 'claude', name: 'Claude Code', reads: 'CLAUDE.md', open: { lines: ['claude'] } },
  { id: 'codex', name: 'Codex', reads: 'AGENTS.md', open: { lines: ['codex'] } },
  { id: 'cursor', name: 'Cursor', reads: 'AGENTS.md', open: { text: 'Open the glassboxapk folder in Cursor and start an Agent chat.' } },
  { id: 'other', name: 'Other agents', reads: 'AGENTS.md', open: { text: 'Open the folder in any coding agent that follows the AGENTS.md convention.' } },
];

export function AgentSetup() {
  const [id, setId] = useState<AgentId>('claude');
  const agent = AGENTS.find((a) => a.id === id)!;

  return (
    <div className="setup">
      <div className="agent-tabs" role="tablist" aria-label="Choose your AI agent">
        {AGENTS.map((a) => (
          <button key={a.id} role="tab" aria-selected={a.id === id} className={a.id === id ? 'on' : ''} onClick={() => setId(a.id)}>
            {a.name}
          </button>
        ))}
      </div>

      <ol className="steps" key={id}>
        <li className="step">
          <span className="step-n">01</span>
          <div className="step-body">
            <h3>Add the repo</h3>
            <p>Clone it once and install. Everything runs on your machine.</p>
            <Command lines={[`git clone ${REPO_URL}`, `cd ${REPO_DIR}`, 'npm install']} />
          </div>
        </li>
        <li className="step">
          <span className="step-n">02</span>
          <div className="step-body">
            <h3>Open it in {agent.name}</h3>
            <p>
              The repo ships with <code>{agent.reads}</code>, so your agent already knows the workflow: how to decompile, what to trace and where to write the report.
            </p>
            {agent.open.lines ? <Command lines={agent.open.lines} /> : <p className="step-note">{agent.open.text}</p>}
          </div>
        </li>
        <li className="step">
          <span className="step-n">03</span>
          <div className="step-body">
            <h3>Hand it the APK</h3>
            <p>Drop the file into the <code>apks/</code> folder, then ask in plain words:</p>
            <Command prompt="›" lines={['Analyze apks/your-app.apk']} />
          </div>
        </li>
        <li className="step">
          <span className="step-n">04</span>
          <div className="step-body">
            <h3>Watch it in your browser</h3>
            <p>
              The agent writes the report and opens the viewer: the system map, every flow animated step by step, and the full inventory. Export the whole thing as <b>PPT</b> or <b>PDF</b> with one click.
            </p>
          </div>
        </li>
      </ol>
    </div>
  );
}
