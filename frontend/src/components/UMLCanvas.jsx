import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Maximize2, Minimize2, RotateCcw, RefreshCw, Eraser, Trash2, Edit3, MoreVertical, LayoutGrid, AlertCircle, Database, Search,
  Square, Circle, Diamond, Type, MousePointer, Move, ZoomIn, ZoomOut, Maximize, Minimize,
  ArrowRight, XCircle, Plus, Info, GripHorizontal, MousePointer2, MousePointerClick, LassoSelect, Copy,
  Lock, Unlock
} from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import { toPng } from 'html-to-image';

const DIAGRAM_MODES = {
  UseCase: {
    color: '#f59e0b',
    elements: [
      { type: 'actor', label: 'Actor', w: 60, h: 90 },
      { type: 'usecase', label: 'Use Case', w: 140, h: 70 },
      { type: 'boundary', label: 'System', w: 250, h: 350 },
      { type: 'text', label: 'Text Label', w: 120, h: 30 },
      { type: 'note', label: 'Note', w: 120, h: 60 },
    ],
    connectors: [
      { type: 'association', label: 'Association', arrow: false, dashed: false },
      { type: 'include', label: 'Include', text: '<<include>>', arrow: true, dashed: true },
      { type: 'extend', label: 'Extend', text: '<<extend>>', arrow: true, dashed: true },
      { type: 'generalization', label: 'Generalization', arrow: true, hollow: true, dashed: false }
    ],
    replaceGroups: { use_case_elements: ['usecase'], actors: ['actor'] }
  },
  Activity: {
    color: '#8b5cf6',
    elements: [
      { type: 'start', label: 'Start', w: 30, h: 30 },
      { type: 'activity', label: 'Activity', w: 120, h: 50 },
      { type: 'decision', label: 'Decision', w: 60, h: 60 },
      { type: 'end', label: 'End', w: 30, h: 30 },
      { type: 'text', label: 'Text Label', w: 120, h: 30 },
      { type: 'note', label: 'Note', w: 120, h: 60 },
    ],
    connectors: [
      { type: 'flow', label: 'Control Flow', arrow: true, dashed: false }
    ],
    replaceGroups: { activity_controls: ['start', 'end', 'decision'], activity_actions: ['activity'] }
  },
  ERD: {
    color: '#3b82f6',
    elements: [
      { type: 'entity', label: 'Entity', w: 120, h: 50 },
      { type: 'attribute', label: 'Attribute', w: 100, h: 45 },
      { type: 'relationship', label: 'Relationship', w: 100, h: 60 },
      { type: 'primary_key', label: 'Primary Key', w: 100, h: 45 },
      { type: 'derived_attr', label: 'Derived', w: 100, h: 45 },
      { type: 'multi_attr', label: 'Multivalued', w: 100, h: 45 },
      { type: 'text', label: 'Text Label', w: 120, h: 30 },
      { type: 'note', label: 'Note', w: 120, h: 60 },
    ],
    connectors: [
      { type: 'association', label: 'Association', arrow: false, dashed: false },
      { type: 'partial_participation', label: 'Partial', arrow: false, dashed: false },
      { type: 'total_participation', label: 'Total', arrow: false, dashed: false, doubleLine: true }
    ],
    replaceGroups: { erd_attrs: ['attribute', 'primary_key', 'derived_attr', 'multi_attr'], erd_entities: ['entity'], erd_rels: ['relationship'] }
  },
  Class: {
    color: '#10b981',
    elements: [
      { type: 'class', label: 'Class\n---', w: 140, h: 100 },
      { type: 'interface', label: 'Interface\n---', w: 140, h: 100 },
      { type: 'annotation', label: 'Annotation', w: 120, h: 40 },
      { type: 'text', label: 'Text Label', w: 120, h: 30 },
      { type: 'note', label: 'Note', w: 120, h: 60 },
    ],
    connectors: [
      { type: 'association', label: 'Association', arrow: true, hollow: false, dashed: false },
      { type: 'inheritance', label: 'Inheritance', arrow: true, hollow: true, dashed: false },
      { type: 'implementation', label: 'Implementation', arrow: true, hollow: true, dashed: true },
      { type: 'dependency', label: 'Dependency', arrow: true, hollow: false, dashed: true },
      { type: 'aggregation', label: 'Aggregation', diamond: 'open', arrow: false, dashed: false },
      { type: 'composition', label: 'Composition', diamond: 'filled', arrow: false, dashed: false }
    ],
    replaceGroups: { class_classifiers: ['class', 'interface', 'annotation'], class_rel_types: ['aggregation', 'composition', 'association'] }
  },
  SequenceDiagram: {
    color: '#0ea5e9',
    elements: [
      { type: 'actor', label: 'Actor', w: 60, h: 90 },
      { type: 'lifeline', label: 'Lifeline', w: 100, h: 300 },
      { type: 'activation', label: 'Activation', w: 16, h: 80 },
      { type: 'text', label: 'Text Label', w: 120, h: 30 },
      { type: 'note', label: 'Note', w: 120, h: 60 },
    ],
    connectors: [
      { type: 'message', label: 'Message', arrow: true, dashed: false },
      { type: 'reply_message', label: 'Reply', arrow: true, dashed: true },
      { type: 'async_message', label: 'Async Message', arrow: true, hollow: true, dashed: false }
    ],
    replaceGroups: { seq_actors: ['actor'], seq_lifes: ['lifeline'], seq_acts: ['activation'] }
  },
  DataFlowDiagram: {
    color: '#ec4899',
    elements: [
      { type: 'external_entity', label: 'External Entity', w: 120, h: 60 },
      { type: 'process', label: 'Process', w: 90, h: 90 },
      { type: 'datastore', label: 'Data Store', w: 120, h: 50 },
      { type: 'text', label: 'Text Label', w: 120, h: 30 },
      { type: 'note', label: 'Note', w: 120, h: 60 },
    ],
    connectors: [
      { type: 'data_flow', label: 'Data Flow', arrow: true, dashed: false }
    ],
    replaceGroups: { dfd_entities: ['external_entity'], dfd_processes: ['process'], dfd_stores: ['datastore'] }
  }
};

class UMLErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { console.error("UML Render Error:", error, errorInfo); }
  render() { if (this.state.hasError) return null; return this.props.children; }
}

const NodeShape = React.memo(({ node, isSelected, isHovered, color }) => {
  const { type, w, h } = node;
  const x = isFinite(node.x) ? node.x : 0;
  const y = isFinite(node.y) ? node.y : 0;
  const cx = x + w / 2, cy = y + h / 2;
  const stroke = isSelected ? '#4f46e5' : (isHovered ? '#6366f1' : color);
  const fill = isSelected ? '#4f46e515' : (isHovered ? '#6366f110' : color + '05');
  const strokeWidth = isSelected ? 3 : (isHovered ? 2.5 : 2);
  const common = { fill, stroke, strokeWidth };

  if (type === 'entity') return <rect x={x} y={y} width={w} height={h} rx="4" {...common} />;
  if (['attribute', 'derived_attr', 'usecase'].includes(type)) {
    return <ellipse cx={cx} cy={cy} rx={w/2} ry={h/2} {...common} strokeDasharray={type==='derived_attr'?"5,3":"none"} />;
  }
  if (type === 'primary_key') {
    return <ellipse cx={cx} cy={cy} rx={w/2} ry={h/2} {...common} strokeWidth={isSelected ? 4 : 3} />;
  }
  if (type === 'multi_attr') {
    return (
      <g>
        <ellipse cx={cx} cy={cy} rx={w/2} ry={h/2} {...common} />
        <ellipse cx={cx} cy={cy} rx={w/2 - 6} ry={h/2 - 6} fill="none" stroke={stroke} strokeWidth={isSelected ? 2 : 1.5} />
      </g>
    );
  }
  if (['relationship', 'decision'].includes(type)) return <polygon points={`${cx},${y} ${x+w},${cy} ${cx},${y+h} ${x},${cy}`} {...common} />;
  if (type === 'class' || type === 'interface') {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} {...common} rx="2" aria-label="Class Box" />
        <line x1={x} y1={y + 30} x2={x+w} y2={y + 30} stroke={stroke} strokeWidth="1.5" />
        <line x1={x} y1={y + h * 0.65} x2={x+w} y2={y + h * 0.65} stroke={stroke} strokeWidth="1.5" />
      </g>
    );
  }
  if (type === 'annotation') return <rect x={x} y={y} width={w} height={h} fill="none" stroke={stroke} strokeWidth="1.5" strokeDasharray="5,3" />;
  if (type === 'actor') return (
    <g transform={`translate(${x},${y})`}>
      <rect x="0" y="0" width={w} height={h} fill="white" fillOpacity="0" />
      <circle cx={w/2} cy={h*0.2} r={Math.min(w,h)*0.15} {...common} />
      <line x1={w/2} y1={h*0.35} x2={w/2} y2={h*0.7} stroke={stroke} strokeWidth={isSelected?3:2} fill="none" />
      <line x1={w*0.2} y1={h*0.45} x2={w*0.8} y2={h*0.45} stroke={stroke} strokeWidth={isSelected?3:2} fill="none" />
      <line x1={w/2} y1={h*0.7} x2={w*0.2} y2={h*0.95} stroke={stroke} strokeWidth={isSelected?3:2} fill="none" />
      <line x1={w/2} y1={h*0.7} x2={w*0.8} y2={h*0.95} stroke={stroke} strokeWidth={isSelected?3:2} fill="none" />
    </g>
  );
  if (type === 'note') return (
    <g>
      <path d={`M${x},${y} L${x+w-12},${y} L${x+w},${y+12} L${x+w},${y+h} L${x},${y+h} Z`}
            fill="#fef08a" stroke="#854d0e" strokeWidth="2" />
      <path d={`M${x+w-12},${y} L${x+w-12},${y+12} L${x+w},${y+12}`}
            fill="#fde047" stroke="#854d0e" strokeWidth="1.5" />
    </g>
  );
  if (type === 'boundary') return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="white" fillOpacity="0" rx="20" />
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={stroke} strokeWidth="2" strokeDasharray="10,5" rx="20" />
    </g>
  );
  if (type === 'start') return <circle cx={cx} cy={cy} r="15" fill={color} />;
  if (type === 'end') return <g><circle cx={cx} cy={cy} r="15" stroke={color} fill="none"/><circle cx={cx} cy={cy} r="10" fill={color}/></g>;
  if (type === 'activity') return <rect x={x} y={y} width={w} height={h} {...common} rx="20" />;
  if (type === 'text') return (
    <rect x={x} y={y} width={w} height={h}
          fill={isSelected ? '#3b82f610' : 'transparent'}
          stroke={isSelected ? '#3b82f6' : 'none'}
          strokeWidth="1" strokeDasharray={isSelected ? '4,3' : 'none'} rx="3" />
  );
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="white" fillOpacity="0" rx="4" />
      <rect x={x} y={y} width={w} height={h} {...common} rx="4" />
    </g>
  );
});

const RenderedNode = React.memo(({ n, isSelected, isHovered, modeColor, onMouseDown, onDoubleClick, onContextMenu, tool, inputNode, anchorCache, connecting, reconnecting, getAnchors, getPos, setConnecting }) => {
  const isBeingDragged = n.isDragging;
  // Guard against invalid coordinates
  const nx = isFinite(n.x) ? n.x : 0;
  const ny = isFinite(n.y) ? n.y : 0;
  const nw = isFinite(n.w) ? n.w : 50;
  const nh = isFinite(n.h) ? n.h : 50;
  const safeNode = { ...n, x: nx, y: ny, w: nw, h: nh };
  const tpos = { 
    x: nx + nw / 2, 
    y: n.type === 'actor' || n.type === 'start' || n.type === 'end' ? ny + nh + 18 : 
       n.type === 'boundary' ? ny + 28 : ny + nh / 2 
  };

  const anchors = anchorCache.get(n.id) || getAnchors(safeNode);
  const connectingToMe = connecting?.toNodeId === n.id;
  const reconnectingToMe = reconnecting?.toNodeId === n.id;
  const showAnchors = !isBeingDragged;

  const labelText = String(n.label ?? '');
  const lines = labelText.split('\n');
  const isClass = n.type === 'class' || n.type === 'interface';
  const labelFill = n.type === 'note' ? '#000000' : 'white';

  return (
    <g
      style={{ pointerEvents: 'auto', opacity: isBeingDragged ? 0.65 : 1 }}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={`node-group select-none ${
        n.locked ? 'cursor-default' :
        tool === 'connect' ? 'cursor-crosshair' :
        isBeingDragged ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Shape */}
      <NodeShape node={safeNode} isSelected={isSelected} isHovered={isHovered} color={modeColor} />

      {/* Lock icon */}
      {n.locked && (
        <g transform={`translate(${nx + nw - 18}, ${ny + 6})`} opacity="0.8">
          <rect width="14" height="14" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1" />
          <path d="M7 4.5V6m0 0h-2.5a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5v-5a.5.5 0 0 0-.5-.5h-2.5m0 0v-1.5a1.5 1.5 0 1 0-3 0v1.5"
                stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </g>
      )}

      {/* Label */}
      {inputNode !== n.id && n.type !== 'start' && n.type !== 'end' && (
        <g>
          {isClass ? (() => {
            const rawParts = labelText.split('---');
            const parts = rawParts.length >= 2 ? rawParts : [lines[0], lines.slice(1).join('\n')];
            const renderPart = (text, partIdx, anchor, sx, sy) => {
              if (!text) return null;
              const plines = String(text).split('\n').filter(l => l.trim());
              return plines.map((line, idx) => (
                <text key={`${partIdx}-${idx}`} x={sx} y={sy + idx * 14}
                      textAnchor={anchor} fill="white" fontSize="10"
                      fontWeight={partIdx === 0 && idx === 0 ? 'bold' : 'normal'}
                      style={{ textTransform: 'none', fontFamily: 'Arial, sans-serif' }}>
                  <tspan fill="white">{line || ' '}</tspan>
                </text>
              ));
            };
            return (
              <g>
                {renderPart(parts[0], 0, 'middle', nx + nw/2, ny + 18)}
                {parts[1] && renderPart(parts[1], 1, 'start', nx + 8, ny + 42)}
                {parts[2] && renderPart(parts[2], 2, 'start', nx + 8, ny + nh * 0.65 + 15)}
              </g>
            );
          })() : (
            <text x={tpos.x} y={tpos.y} textAnchor="middle" fill={labelFill}
                  fontSize={n.type === 'text' ? 14 : 12}
                  fontWeight={n.type === 'text' ? '400' : 'bold'}
                  style={{ textTransform: 'none', textDecoration: n.type === 'primary_key' ? 'underline' : 'none', fontFamily: 'Arial, sans-serif' }}>
              {lines.map((line, i) => (
                <tspan key={i} x={tpos.x} dy={i === 0 ? `${-(lines.length - 1) * 0.5 + 0.3}em` : '1.1em'} fill={labelFill}>{line || ' '}</tspan>
              ))}
            </text>
          )}
        </g>
      )}

      {/* Anchor points - only show when not dragging */}
      {showAnchors && anchors.map((p, i) => (
        <AnchorPoint
          key={i} x={p.x} y={p.y}
          isSnapTarget={(connectingToMe && connecting.toAnchor === i) || (reconnectingToMe && reconnecting.toAnchor === i)}
          onMouseDown={(ev) => { ev.stopPropagation(); setConnecting({ from: n.id, fromAnchor: i, current: getPos(ev) }); }}
        />
      ))}
    </g>
  );
}, (p, n) => {
  // Only re-render when something actually visual changes
  return (
    p.n.x === n.n.x && p.n.y === n.n.y &&
    p.n.w === n.n.w && p.n.h === n.n.h &&
    p.n.label === n.n.label &&
    p.n.isDragging === n.n.isDragging &&
    p.n.locked === n.n.locked &&
    p.isSelected === n.isSelected &&
    p.isHovered === n.isHovered &&
    p.inputNode === n.inputNode &&
    p.tool === n.tool &&
    p.connecting?.toNodeId === n.connecting?.toNodeId &&
    p.connecting?.toAnchor === n.connecting?.toAnchor &&
    p.reconnecting?.toNodeId === n.reconnecting?.toNodeId &&
    p.reconnecting?.toAnchor === n.reconnecting?.toAnchor
  );
});

const DiagramTextEditor = ({ n, tpos, inputRef, setNodes, setInputNode, save, nodes, edges, inputNode }) => {
  const [typos, setTypos] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const isMultiline = ['note', 'text'].includes(n.type);
  const EditorTag = isMultiline ? 'textarea' : 'input';

  useEffect(() => {
    if (!n.label) { setTypos([]); setSuggestions([]); setShowMenu(false); return; }
    
    const dictionary = [
      'User', 'Admin', 'Customer', 'Client', 'Login', 'Logout', 'SignUp', 'Register', 'Authentication', 'Password', 'Username', 'Email', 'Profile', 'Dashboard', 'Settings', 'Notifications', 'Messages', 'Search', 'Filter', 'Create', 'Add', 'Update', 'Edit', 'Delete', 'Cancel', 'Submit', 'Undo', 'Redo', 'Print', 'Export', 'Download', 'Connect', 'Link', 'Group', 'Move', 'Lock', 'Unlock', 'Hide', 'Show', 'View', 'List', 'Table', 'Chart', 'Report', 'Analysis', 'Help', 'Home', 'Back', 'Next', 'Finish', 'Done', 'Success', 'Error', 'Failed', 'Pending', 'Loading', 'Wait', 'Retry', 'Role', 'Permission', 'Access', 'Security', 'Privacy', 'Token', 'ID', 'Code', 'Value', 'Score', 'Grade', 'Result', 'Output', 'Input', 'Data', 'Attribute', 'Method', 'Function', 'Variable', 'Enum', 'Interface', 'Class', 'Abstract', 'Static', 'Public', 'Private', 'Internal', 'Package', 'Module', 'Component', 'Service', 'Controller', 'Model', 'View', 'Core', 'Node', 'Edge', 'Relationship', 'Connection', 'Association', 'Aggregation', 'Composition', 'Dependency', 'Inheritance', 'Generalization', 'Realization', 'Constraint', 'Annotation', 'Actor', 'UseCase', 'SystemBoundary', 'State', 'Activity', 'Transition', 'Initial', 'Final', 'Decision', 'Merge', 'Fork', 'Join', 'Object', 'Lifeline', 'Message', 'Call', 'Return', 'Signal', 'Guard', 'Loop', 'Alternative', 'Option', 'Parallel', 'Entity', 'Relation', 'Index', 'Unique', 'Schema', 'Database', 'Query', 'Transaction', 'Commit', 'Rollback', 'Wait', 'Poll', 'Handle', 'Request', 'Response', 'Status', 'Gateway', 'Timeout', 'Remote', 'Proxy', 'Middleware', 'Bridge', 'Adapter', 'Decorator', 'Strategy', 'Factory', 'Singleton', 'Observer', 'Template', 'Visitor', 'Iterator', 'Builder', 'Prototype', 'Flyweight', 'Facade', 'Mediator', 'Forget Password', 'Reset Password', 'Validation', 'Verification'
    ];

    const getBigrams = s => {
       const res = new Set();
       const str = String(s).toLowerCase();
       for (let i = 0; i < str.length - 1; i++) res.add(str.substring(i, i + 2));
       return res;
    };
    const dice = (s1, s2) => {
       const b1 = getBigrams(s1), b2 = getBigrams(s2);
       let intersection = 0;
       b1.forEach(x => { if (b2.has(x)) intersection++; });
       return (2 * intersection) / (b1.size + b2.size || 1);
    };
    const lev = (a, b) => {
       const t = [];
       for (let i = 0; i <= a.length; i++) t[i] = [i];
       for (let j = 0; j <= b.length; j++) t[0][j] = j;
       for (let i = 1; i <= a.length; i++) {
         for (let j = 1; j <= b.length; j++) {
           t[i][j] = Math.min(t[i-1][j]+1, t[i][j-1]+1, t[i-1][j-1] + (a[i-1]===b[j-1]?0:1));
         }
       }
       return t[a.length][b.length];
    };

    const labelStr = n.label || '';
    const lastChar = labelStr.slice(-1);
    const isWordEnding = /[\s.,;?!_]/.test(lastChar);
    const words = labelStr.split(/[\s_,-]+/);

    // Stage 1: Continuous Underlining (Background)
    const underlineTimer = setTimeout(() => {
      const foundTypos = words.filter(w => {
        const clean = w.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (clean.length < 3) return false;
        const isCommonAbbr = ['usr', 'pwd', 'auth', 'reg', 'ctrl', 'msg', 'db', 'ui', 'ux'].includes(clean);
        return !isCommonAbbr && !dictionary.some(d => d.toLowerCase() === clean);
      });
      setTypos(foundTypos);
    }, 800);

    // Stage 2: Automatic Suggestions on Word Completion (Space)
    const suggestionTimer = setTimeout(() => {
      if (!isWordEnding) { setShowMenu(false); return; }
      
      const lastWord = words[words.length - 1] || words[words.length - 2];
      if (!lastWord) return;

      const clean = lastWord.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean.length < 4) return;
      
      const exact = dictionary.find(d => d.toLowerCase() === clean);
      if (!exact) {
         const scored = dictionary.map(d => {
           const target = d.toLowerCase().replace(/\s/g, '');
           const dScore = dice(clean, target), lDist = lev(clean, target);
           const normLev = lDist / Math.max(clean.length, target.length);
           const combined = dScore * 0.4 + (1 - normLev) * 0.6;
           const prefixBonus = target.startsWith(clean) ? 0.35 : (target.startsWith(clean.substring(0, 3)) ? 0.15 : 0);
           const domainBoost = (clean === 'forgt' && d.includes('Forget')) ? 0.25 : (clean === 'logn' && d.includes('Login')) ? 0.25 : 0;
           return { word: d, score: combined + prefixBonus + domainBoost };
         });
         
         const best = scored.filter(s => s.score > 0.82).sort((a,b) => b.score - a.score).slice(0, 3).map(s => s.word);
         if (best.length > 0) {
           setSuggestions([{ wrong: lastWord, options: best }]);
           setShowMenu(true);
         }
      }
    }, isWordEnding ? 50 : 2000); // 2sec delay if typing, but 50ms if space pressed

    return () => {
      clearTimeout(underlineTimer);
      clearTimeout(suggestionTimer);
    };
  }, [n.label]);

  const applyFix = (wrong, correct) => {
    setNodes(ns => ns.map(x => x.id === inputNode ? {...x, label: x.label.replace(wrong, correct)} : x));
    setShowMenu(false);
    inputRef.current?.focus();
  };

  return (
    <>
      <EditorTag ref={inputRef}
             className={`absolute ${n.type === 'note' ? 'bg-[#fef08a] text-black border-[#854d0e]' : 'bg-[#1e293b] text-slate-900 dark:text-white ' + (typos.length ? 'border-rose-500/60' : 'border-indigo-500/40')} border-2 rounded-xl px-4 py-2 outline-none shadow-2xl z-50 text-center label-input
               ${n.type === 'text' ? 'text-sm font-normal normal-case' : 'text-sm font-bold normal-case'} ${isMultiline ? 'resize-none flex items-center justify-center pt-3' : ''} ${typos.length ? 'underline decoration-rose-500/60 decoration-wavy underline-offset-4' : ''}`}
             style={{ 
               left: tpos.x, top: tpos.y, transform: 'translate(-50%,-50%)', 
               minWidth: n.type === 'text' ? 180 : 160, 
               height: isMultiline ? 'auto' : undefined,
               minHeight: isMultiline ? 80 : undefined,
               textTransform: 'none' 
             }}
             onFocus={() => setIsFocused(true)}
             onBlur={() => { 
                setTimeout(() => { if (inputNode === n.id) { setIsFocused(false); setInputNode(null); save(nodes, edges); } }, 200); 
             }}
             onClick={() => { if (typos.length > 0) setShowMenu(true); }}
             rows={isMultiline ? 3 : 1}
             value={n.label} onChange={e => {
               const val = e.target.value;
               setShowMenu(false);
               setNodes(ns => ns.map(x => x.id === inputNode ? {...x, label: val} : x));
             }}
             onMouseDown={e => e.stopPropagation()}
             onKeyDown={e => {
               if (e.key === 'Enter' && !e.shiftKey && !isMultiline) {
                 e.preventDefault();
                 e.target.blur();
               }
             }} />
             
      {showMenu && suggestions.length > 0 && isFocused && (
        <div className="spellcheck-suggestions absolute z-[10000] p-1.5 bg-[#171f2d]/95 border border-rose-500/50 backdrop-blur-2xl rounded-2xl shadow-[0_20px_50px_-10px_rgba(225,29,72,0.4)] flex flex-col gap-1 min-w-[140px] animate-in slide-in-from-top-2 zoom-in-95 pointer-events-auto"
             style={{ left: tpos.x, top: tpos.y + (isMultiline ? 65 : 35), transform: 'translate(-50%, 0)' }}
             onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}>
           <div className="px-2 py-1 text-[9px] font-black text-rose-400/60 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
              Suggestions
           </div>
           {suggestions[0].options.map((opt, i) => (
             <button key={i} 
                     onClick={() => applyFix(suggestions[0].wrong, opt)}
                     className="w-full text-left px-3 py-2 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-rose-500 hover:text-slate-900 dark:text-white transition-all flex items-center justify-between group">
                {opt}
                <span className="text-[8px] opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 px-1 rounded uppercase">Fix</span>
             </button>
           ))}
        </div>
      )}
    </>
  );
};

const getAnchors = (n) => {
  const x = isFinite(n.x) ? n.x : 0;
  const y = isFinite(n.y) ? n.y : 0;
  const w = isFinite(n.w) ? n.w : 50;
  const h = isFinite(n.h) ? n.h : 50;
  return [
    { x: x + w/2, y: y, type: 'top' },        
    { x: x + w/2, y: y + h, type: 'bottom' },  
    { x: x, y: y + h/2, type: 'left' },        
    { x: x + w, y: y + h/2, type: 'right' }   
  ];
};

const AnchorPoint = React.memo(({ x, y, onMouseDown, isSnapTarget }) => {
  return (
    <circle 
      cx={x} cy={y} r={isSnapTarget ? 8 : 6} 
      fill={isSnapTarget ? "#6366f1" : "#3b82f6"} 
      stroke="white" 
      strokeWidth={isSnapTarget ? 3 : 2}
      className="connection-handle"
      style={{ 
        transformOrigin: `${x}px ${y}px`,
        transition: 'all 0.15s ease-out'
      }}
      onMouseDown={onMouseDown}
    />
  );
});

const ConnectionLine = React.memo(({ edge, from, to, color, isSelected, isHovered, onMouseDown, onContextMenu, onEndpointDrag }) => {
  if (!from || !to) return null;

  const a1s = getAnchors(from);
  const a2s = getAnchors(to);
  let p1, p2;

  if (edge.fromAnchor !== undefined && edge.toAnchor !== undefined) {
    p1 = a1s[edge.fromAnchor] || a1s[0];
    p2 = a2s[edge.toAnchor] || a2s[0];
  } else {
    p1 = a1s[0]; p2 = a2s[0];
    let minDist = Infinity;
    a1s.forEach(pp1 => {
        a2s.forEach(pp2 => {
            const d = Math.sqrt((pp1.x-pp2.x)**2 + (pp1.y-pp2.y)**2);
            if (d < minDist) { minDist = d; p1 = pp1; p2 = pp2; }
        });
    });
  }

  if (!p1 || !p2 || !isFinite(p1.x) || !isFinite(p1.y) || !isFinite(p2.x) || !isFinite(p2.y)) return null;

  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const stroke = isSelected ? '#4f46e5' : (isHovered ? '#6366f1' : color);
  const dash = edge.dashed ? "8,4" : "none";
  const strokeWidth = isSelected ? 4 : (isHovered ? 3.5 : 2.5);

  let head = null;
  if (edge.arrow) {
    if (edge.hollow) head = <path d="M-15,-8 L0,0 L-15,8 Z" fill="#020617" stroke={stroke} strokeWidth="2" />;
    else head = <path d="M-12,-8 L0,0 L-12,8" fill="none" stroke={stroke} strokeWidth="2.5" />;
  }

  let tail = null;
  if (edge.diamond) {
    if (edge.diamond === 'filled') tail = <polygon points="0,0 12,6 24,0 12,-6" fill={stroke} stroke={stroke} strokeWidth="1" />;
    else tail = <polygon points="0,0 12,6 24,0 12,-6" fill="#020617" stroke={stroke} strokeWidth="2" />;
  }

  return (
    <g className="cursor-grab" onMouseDown={onMouseDown} onContextMenu={onContextMenu}>
      {/* Wide invisible stroke for easy clicking */}
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth="20" />
      {/* Visible line(s) — double line for total participation */}
      {edge.doubleLine ? (() => {
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        const px = -dy/len * 3, py = dx/len * 3;
        return (
          <>
            <line x1={p1.x+px} y1={p1.y+py} x2={p2.x+px} y2={p2.y+py} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />
            <line x1={p1.x-px} y1={p1.y-py} x2={p2.x-px} y2={p2.y-py} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />
          </>
        );
      })() : (
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />
      )}
      {head && <g transform={`translate(${p2.x},${p2.y}) rotate(${angle})`}>{head}</g>}
      {tail && <g transform={`translate(${p1.x},${p1.y}) rotate(${angle})`}>{tail}</g>}
      {edge.text && (
        <g transform={`translate(${(p1.x+p2.x)/2},${(p1.y+p2.y)/2})`}>
          <rect x="-40" y="-12" width="80" height="20" rx="4" fill="#020617" fillOpacity="0.8" stroke={isSelected ? '#3b82f6' : 'none'} />
          <text textAnchor="middle" dy="2" fill="white" fontSize="9" fontWeight="bold" className="normal-case" style={{textTransform:'none', fontFamily: 'Inter, sans-serif'}}>{edge.text}</text>
        </g>
      )}
    </g>
  );
}, (prev, next) => {
  return prev.edge.id === next.edge.id && prev.edge.fromAnchor === next.edge.fromAnchor && prev.edge.toAnchor === next.edge.toAnchor &&
         prev.edge.doubleLine === next.edge.doubleLine && prev.edge.dashed === next.edge.dashed && prev.edge.text === next.edge.text &&
         prev.from?.x === next.from?.x && prev.from?.y === next.from?.y && prev.from?.w === next.from?.w && prev.from?.h === next.from?.h &&
         prev.to?.x === next.to?.x && prev.to?.y === next.to?.y && prev.to?.w === next.to?.w && prev.to?.h === next.to?.h &&
         prev.isSelected === next.isSelected && prev.isHovered === next.isHovered && prev.color === next.color;
});

const ElementPreview = ({ type, color }) => {
  const s = color;
  const f = color + '30';
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" style={{overflow:'visible'}}>
      {type === 'entity'       && <rect x="3" y="8" width="30" height="20" rx="2" fill={f} stroke={s} strokeWidth="1.8"/>}
      {type === 'relationship' && <polygon points="18,4 34,18 18,32 2,18" fill={f} stroke={s} strokeWidth="1.8"/>}
      {type === 'attribute'    && <ellipse cx="18" cy="18" rx="15" ry="11" fill={f} stroke={s} strokeWidth="1.8"/>}
      {type === 'primary_key'  && <g><ellipse cx="18" cy="18" rx="15" ry="11" fill={f} stroke={s} strokeWidth="2.5"/><ellipse cx="18" cy="18" rx="10" ry="7" fill="none" stroke={s} strokeWidth="1"/></g>}
      {type === 'derived_attr' && <ellipse cx="18" cy="18" rx="15" ry="11" fill={f} stroke={s} strokeWidth="1.8" strokeDasharray="4,2"/>}
      {type === 'multi_attr'   && <g><ellipse cx="18" cy="18" rx="15" ry="11" fill={f} stroke={s} strokeWidth="1.8"/><ellipse cx="18" cy="18" rx="10" ry="7" fill="none" stroke={s} strokeWidth="1"/></g>}
      {type === 'class'        && <g><rect x="3" y="5" width="30" height="26" rx="3" fill={f} stroke={s} strokeWidth="1.8"/><line x1="3" y1="15" x2="33" y2="15" stroke={s} strokeWidth="1.2"/></g>}
      {type === 'interface'    && <g><rect x="3" y="5" width="30" height="26" rx="3" fill={f} stroke={s} strokeWidth="1.8"/><line x1="3" y1="15" x2="33" y2="15" stroke={s} strokeWidth="1.2"/><text x="18" y="12" textAnchor="middle" fill={s} fontSize="6" fontStyle="italic">«i»</text></g>}
      {type === 'annotation'   && <rect x="3" y="8" width="30" height="20" rx="2" fill="none" stroke={s} strokeWidth="1.8" strokeDasharray="4,2"/>}
      {type === 'actor'        && <g><circle cx="18" cy="7" r="5" fill={f} stroke={s} strokeWidth="1.8"/><line x1="18" y1="12" x2="18" y2="24" stroke={s} strokeWidth="1.8"/><line x1="10" y1="17" x2="26" y2="17" stroke={s} strokeWidth="1.8"/><line x1="18" y1="24" x2="11" y2="33" stroke={s} strokeWidth="1.8"/><line x1="18" y1="24" x2="25" y2="33" stroke={s} strokeWidth="1.8"/></g>}
      {type === 'usecase'      && <ellipse cx="18" cy="18" rx="15" ry="11" fill={f} stroke={s} strokeWidth="1.8"/>}
      {type === 'boundary'     && <rect x="3" y="5" width="30" height="26" rx="6" fill="none" stroke={s} strokeWidth="1.8" strokeDasharray="5,3"/>}
      {type === 'note'         && <path d="M4,4 L24,4 L32,12 L32,32 L4,32 Z" fill="#fef08a" stroke="#854d0e" strokeWidth="1.5" />}
      {type === 'start'        && <circle cx="18" cy="18" r="12" fill={s}/>}
      {type === 'end'          && <g><circle cx="18" cy="18" r="12" fill="none" stroke={s} strokeWidth="2"/><circle cx="18" cy="18" r="7" fill={s}/></g>}
      {type === 'activity'     && <rect x="3" y="10" width="30" height="16" rx="8" fill={f} stroke={s} strokeWidth="1.8"/>}
      {type === 'decision'     && <polygon points="18,4 33,18 18,32 3,18" fill={f} stroke={s} strokeWidth="1.8"/>}
      {type === 'text'         && <g><text x="18" y="21" textAnchor="middle" fill={s} fontSize="14" fontWeight="bold">T</text><line x1="10" y1="25" x2="26" y2="25" stroke={s} strokeWidth="1.5"/></g>}
      {type === 'lifeline'     && <g><rect x="6" y="3" width="24" height="12" rx="2" fill={f} stroke={s} strokeWidth="1.5"/><line x1="18" y1="15" x2="18" y2="34" stroke={s} strokeWidth="1.8" strokeDasharray="3,2"/></g>}
      {type === 'activation'   && <rect x="14" y="6" width="8" height="24" fill={s} stroke={s} strokeWidth="1"/>}
      {type === 'external_entity' && <g><rect x="6" y="10" width="28" height="18" rx="2" fill="black" opacity="0.4"/><rect x="3" y="7" width="28" height="18" rx="2" fill={f} stroke={s} strokeWidth="1.8"/></g>}
      {type === 'process'      && <circle cx="18" cy="18" r="14" fill={f} stroke={s} strokeWidth="1.8"/>}
      {type === 'datastore'    && <g><line x1="3" y1="10" x2="33" y2="10" stroke={s} strokeWidth="1.8"/><line x1="3" y1="26" x2="33" y2="26" stroke={s} strokeWidth="1.8"/><line x1="3" y1="10" x2="3" y2="26" stroke={s} strokeWidth="1.8"/><rect x="4" y="11" width="29" height="14" fill={f} stroke="none"/></g>}
    </svg>
  );
};

const ConnectorPreview = ({ connector, color }) => {
  const { arrow, hollow, dashed, diamond, text, doubleLine } = connector;
  const dash = dashed ? "4,3" : "none";
  return (
    <svg width="40" height="20" viewBox="0 0 40 20">
      {doubleLine ? (
        <>
          <line x1="2" y1="7" x2="30" y2="7" stroke={color} strokeWidth="2" strokeDasharray={dash}/>
          <line x1="2" y1="13" x2="30" y2="13" stroke={color} strokeWidth="2" strokeDasharray={dash}/>
          <circle cx="34" cy="10" r="3" fill={color}/>
        </>
      ) : (
        <>
          <line x1="2" y1="10" x2={diamond ? "24" : "30"} y2="10" stroke={color} strokeWidth="2" strokeDasharray={dash}/>
          {arrow && !hollow && <polygon points="40,10 30,6 30,14" fill={color}/>}
          {arrow &&  hollow && <polygon points="40,10 30,6 30,14" fill="#020617" stroke={color} strokeWidth="1.5"/>}
          {diamond === 'open'   && <polygon points="40,10 32,6 24,10 32,14" fill="#020617" stroke={color} strokeWidth="1.5"/>}
          {diamond === 'filled' && <polygon points="40,10 32,6 24,10 32,14" fill={color}/>}
          {!arrow && !diamond   && <circle cx="34" cy="10" r="3" fill={color}/>}
        </>
      )}
    </svg>
  );
};

const UMLCanvas = ({ value, onChange, diagramType = 'Class', onImageExport, isEditable = true }) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [tool, setTool] = useState('select');
  const [activeConnector, setActiveConnector] = useState(null);
  const [search, setSearch] = useState('');

  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [reconnecting, setReconnecting] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const [isToolLocked, setIsToolLocked] = useState(false);

  const [contextMenu, setContextMenu] = useState(null);
  const [inputNode, setInputNode] = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const inputRef = useRef(null);
  const clipboardRef = useRef({ nodes: [], edges: [] });

  const containerRef = useRef(null);
  const surfaceRef = useRef(null);
  const surfaceRectRef = useRef(null);
  const rafRef = useRef(null);
  const [hoveredId, setHoveredId] = useState(null);
  const mode = useMemo(() => DIAGRAM_MODES[diagramType.replace(/\s/g,'')] || DIAGRAM_MODES.Class, [diagramType]);

  const filteredElements = useMemo(() => mode.elements.filter(el => el.label.toLowerCase().includes(search.toLowerCase())), [mode, search]);
  const filteredConnectors = useMemo(() => mode.connectors.filter(c => c.label.toLowerCase().includes(search.toLowerCase())), [mode, search]);

  const [history, setHistory] = useState({ past: [], future: [] });

  const latestGraphRef = useRef({ nodes: [], edges: [] });
  const lastPushedGraphRef = useRef(null);

  const anchorCache = useMemo(() => {
    const cache = new Map();
    nodes.forEach(n => cache.set(n.id, getAnchors(n)));
    return cache;
  }, [nodes]);

  const save = useCallback((ns, es, pushToHistory = true) => {
    const currentState = { nodes: ns, edges: es };
    latestGraphRef.current = currentState;
    
    const outStr = JSON.stringify({ graph: currentState });
    lastPushedGraphRef.current = JSON.stringify(currentState);
    onChange(outStr);

    clearTimeout(window._umlCaptureTimeout);
    window._umlCaptureTimeout = setTimeout(async () => {
      if (surfaceRef.current) {
        try {
          const node = surfaceRef.current;
          const rect = node.getBoundingClientRect();
          const img = await toPng(node, { 
            width: rect.width,
            height: rect.height,
            backgroundColor: '#080c18', 
            pixelRatio: 2.5, // High resolution for clear record
            cacheBust: true,
            style: {
              fontFamily: 'Arial, sans-serif',
              imageRendering: 'auto'
            },
            filter: (node) => {
              const cls = node?.classList;
              if (!cls) return true;
              return !cls.contains('floating-actions') && 
                     !cls.contains('context-menu') && 
                     !cls.contains('resize-handle-group') &&
                     !cls.contains('shortcuts-panel') &&
                     !cls.contains('spellcheck-suggestions') &&
                     !cls.contains('shortcuts-help-btn');
            }
          });
          onChange(JSON.stringify({ graph: latestGraphRef.current, image: img }));
          
          if (onImageExport) {
             onImageExport(img);
          }
        } catch(e) {
          console.error("UML Canvas Image Export Error:", e);
        }
      }
    }, 1500);

    if (pushToHistory) {
      setHistory(prev => ({
        past: [...prev.past.slice(-50), { nodes: ns, edges: es }],
        future: []
      }));
    }
  }, [onChange, onImageExport]);

  const undo = useCallback(() => {
    if (history.past.length <= 1) return;
    const current = history.past[history.past.length - 1];
    const prev = history.past[history.past.length - 2];
    setHistory(h => ({
      past: h.past.slice(0, -1),
      future: [current, ...h.future]
    }));
    setNodes(prev.nodes);
    setEdges(prev.edges);
    save(prev.nodes, prev.edges, false);
    toast.success('Undo', { duration: 1000, position: 'bottom-center' });
  }, [history, save]);

  const redo = useCallback(() => {
    if (history.future.length === 0) return;
    const next = history.future[0];
    setHistory(h => ({
      past: [...h.past, next],
      future: h.future.slice(1)
    }));
    setNodes(next.nodes);
    setEdges(next.edges);
    save(next.nodes, next.edges, false);
    toast.success('Redo', { duration: 1000, position: 'bottom-center' });
  }, [history, save]);

  const clearCanvas = () => {
    if (nodes.length === 0 && edges.length === 0) return;
    if (window.confirm('Clear all elements?')) {
      setNodes([]); setEdges([]); setSelectedIds([]);
      save([], []);
    }
  };

  useEffect(() => {
    try {
      const v = typeof value === 'string' ? JSON.parse(value) : value;
      const g = v?.graph || { nodes: [], edges: [] };
      const gStr = JSON.stringify(g);

      if (gStr === lastPushedGraphRef.current) return;

      setNodes(g.nodes || []);
      setEdges(g.edges || []);
      latestGraphRef.current = g;
      lastPushedGraphRef.current = gStr;
      
      setHistory(h => h.past.length === 0 ? { past: [{ nodes: g.nodes || [], edges: g.edges || [] }], future: [] } : h);
    } catch(e) { }
  }, [value]);

  const getPos = (e) => {
    if (!surfaceRectRef.current) surfaceRectRef.current = surfaceRef.current.getBoundingClientRect();
    const rect = surfaceRectRef.current;
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    return { x: isFinite(x) ? x : 0, y: isFinite(y) ? y : 0 };
  };

  const findTarget = useCallback((pos, padding = 0) => {
    const isInsideShape = (n, p) => {
      const px = padding;
      if (['attribute', 'derived_attr', 'usecase', 'primary_key', 'multi_attr', 'process'].includes(n.type)) {
        const dx = p.x - (n.x + n.w / 2), dy = p.y - (n.y + n.h / 2);
        const rx = n.w / 2 + px, ry = n.h / 2 + px;
        return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1.15;
      }
      if (['relationship', 'decision'].includes(n.type)) {
        const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
        const dx = Math.abs(p.x - cx) / (n.w / 2 + px), dy = Math.abs(p.y - cy) / (n.h / 2 + px);
        return dx + dy <= 1.2;
      }
      if (n.type === 'start' || n.type === 'end') {
        return Math.hypot(p.x - (n.x + n.w / 2), p.y - (n.y + n.h / 2)) <= Math.max(n.w, n.h) / 2 + px + 2;
      }
      return p.x >= n.x - px && p.x <= n.x + n.w + px && p.y >= n.y - px && p.y <= n.y + n.h + px;
    };

    const sorted = [...nodes].reverse();
    const nodesInTypeOrder = [
      ...sorted.filter(n => n.type !== 'boundary'),
      ...sorted.filter(n => n.type === 'boundary')
    ];

    return nodesInTypeOrder.find(n => isInsideShape(n, pos));
  }, [nodes]);

  const findConnectTarget = useCallback((pos, excludeId) => {
    const nonBoundaries = nodes.filter(n => n.type !== 'boundary' && n.id !== excludeId);

    const directHit = [...nonBoundaries].reverse().find(n =>
      pos.x >= n.x - 5 && pos.x <= n.x + n.w + 5 && pos.y >= n.y - 5 && pos.y <= n.y + n.h + 5
    );
    if (directHit) return directHit;

    let nearest = null, nearestD = Infinity;
    nonBoundaries.forEach(n => {
      const anchors = anchorCache.get(n.id) || getAnchors(n);
      anchors.forEach(a => {
        const d = Math.hypot(a.x - pos.x, a.y - pos.y);
        if (d < 60 && d < nearestD) { nearestD = d; nearest = n; }
      });
    });
    if (nearest) return nearest;

    return [...nodes].filter(n => n.type === 'boundary' && n.id !== excludeId).reverse()
      .find(n => pos.x >= n.x && pos.x <= n.x + n.w && pos.y >= n.y && pos.y <= n.y + n.h);
  }, [nodes, anchorCache]);

  const deleteSelected = useCallback(() => {
    const ns = nodes.filter(n => !selectedIds.includes(n.id));
    const es = edges.filter(e => !selectedIds.includes(e.id) && !selectedIds.includes(e.from) && !selectedIds.includes(e.to));
    setNodes(ns); setEdges(es); setSelectedIds([]); save(ns, es);
  }, [nodes, edges, selectedIds, save]);

  const handleMouseDown = (e) => {
    if (contextMenu) { setContextMenu(null); return; }
    if (e.target.tagName === 'INPUT' || e.target.closest('.floating-actions')) return;

    const pos = getPos(e);
    if (resizing || dragging || connecting || reconnecting || marquee) return;

    // Use a 10px padding for more reliable clicks on elements
    const target = findTarget(pos, 10);

    const hitEdge = edges.find(ed => {
      const f = nodes.find(n => n.id === ed.from);
      const t = nodes.find(n => n.id === ed.to);
      if (!f || !t) return false;
      const a1 = (anchorCache.get(f.id) || getAnchors(f))[ed.fromAnchor] || getAnchors(f)[0];
      const a2 = (anchorCache.get(t.id) || getAnchors(t))[ed.toAnchor] || getAnchors(t)[0];
      const L2 = (a2.x - a1.x) ** 2 + (a2.y - a1.y) ** 2;
      if (L2 === 0) return false;
      const t_clamped = Math.max(0, Math.min(1, ((pos.x - a1.x) * (a2.x - a1.x) + (pos.y - a1.y) * (a2.y - a1.y)) / L2));
      return Math.hypot(pos.x - (a1.x + t_clamped * (a2.x - a1.x)), pos.y - (a1.y + t_clamped * (a2.y - a1.y))) < 15;
    });

    if (selectedIds.length === 1) {
      const n = nodes.find(ni => ni.id === selectedIds[0]);
      if (n) {
        const handles = ['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left'];
        for (const h of handles) {
          let hx = n.x, hy = n.y;
          if (h.includes('right')) hx += n.w;
          if (h.includes('bottom')) hy += n.h;
          if (h === 'top' || h === 'bottom') hx += n.w/2;
          if (h === 'left' || h === 'right') hy += n.h/2;
          if (Math.hypot(pos.x - hx, pos.y - hy) < 20) {
            if (n.locked) { shortcutToast('\uD83D\uDD12 Element is Locked'); return; }
            setResizing({ id: n.id, handle: h, startPos: pos, nodeStart: { ...n } });
            return;
          }
        }
      }
    }

    if (tool === 'connect' && target && target.type !== 'boundary') {
      const anchors = anchorCache.get(target.id) || getAnchors(target);
      const dists = anchors.map(a => Math.hypot(a.x - pos.x, a.y - pos.y));
      const minD = Math.min(...dists);
      if (minD < 18) {
        setConnecting({ from: target.id, fromAnchor: dists.indexOf(minD), current: pos });
        return;
      }
    }

    const selectedNodes = nodes.filter(n => selectedIds.includes(n.id));
    let isInsideSelectionBounds = false;
    if (selectedNodes.length > 1) {
      const bX = Math.min(...selectedNodes.map(n => n.x)), bY = Math.min(...selectedNodes.map(n => n.y));
      const bW = Math.max(...selectedNodes.map(n => n.x + n.w)) - bX, bH = Math.max(...selectedNodes.map(n => n.y + n.h)) - bY;
      isInsideSelectionBounds = pos.x >= bX - 5 && pos.x <= bX + bW + 5 && pos.y >= bY - 5 && pos.y <= bY + bH + 5;
    }

    if (target && target.type !== 'boundary') {
        const ids = e.shiftKey ? [...selectedIds, target.id] : (selectedIds.includes(target.id) ? selectedIds : [target.id]);
        setSelectedIds(ids);
        const draggableIds = nodes.filter(n => ids.includes(n.id) && !n.locked).map(n => n.id);
        if (draggableIds.length > 0) {
          setDragging({ 
            ids: new Set(draggableIds), 
            start: pos, 
            initial: nodes.filter(n => draggableIds.includes(n.id)) 
          });
        }
    } else if (isInsideSelectionBounds && !hitEdge) {
       const draggableIds = nodes.filter(n => selectedIds.includes(n.id) && !n.locked).map(n => n.id);
       if (draggableIds.length > 0) {
         setDragging({ 
           ids: new Set(draggableIds), 
           start: pos, 
           initial: nodes.filter(n => draggableIds.includes(n.id)) 
         });
       }
    } else if (hitEdge) {
       setSelectedIds(e.shiftKey ? [...selectedIds, hitEdge.id] : [hitEdge.id]);
    } else if (target && target.type === 'boundary') {
       setSelectedIds([target.id]);
       if (!target.locked) {
         setDragging({ 
           ids: new Set([target.id]), 
           start: pos, 
           initial: [target] 
         });
       }
    } else {
       setSelectedIds([]);
       if (inputNode) setInputNode(null);
       if (tool === 'select') setMarquee({ start: pos, end: pos });
    }
    surfaceRectRef.current = surfaceRef.current.getBoundingClientRect();
  };

  const handleMouseMove = (e) => {
    const pos = getPos(e);
    
    if (!resizing && !dragging && !connecting && !reconnecting && !marquee) {
       const t = findTarget(pos);
       setHoveredId(t ? t.id : null);
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (dragging) {
        const dx = pos.x - dragging.start.x, dy = pos.y - dragging.start.y;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        
        setNodes(ns => ns.map(n => {
          if (!dragging.ids.has(n.id)) return n;
          const m = dragging.initial.find(i => i.id === n.id);
          return m ? { ...n, x: m.x + dx, y: m.y + dy, isDragging: true } : n;
        }));
      } else if (resizing) {
        const { id, handle, startPos, nodeStart } = resizing;
        const dx = pos.x - startPos.x, dy = pos.y - startPos.y;
        setNodes(ns => ns.map(n => {
          if (n.id !== id) return n;
          let { x, y, w, h } = nodeStart;
          if (handle.includes('right')) w = Math.max(50, nodeStart.w + dx);
          if (handle.includes('left') && nodeStart.w - dx > 50) { x = nodeStart.x + dx; w = nodeStart.w - dx; }
          if (handle.includes('bottom')) h = Math.max(30, nodeStart.h + dy);
          if (handle.includes('top') && nodeStart.h - dy > 30) { y = nodeStart.y + dy; h = nodeStart.h - dy; }
          return { ...n, x, y, w, h };
        }));
      } else if (connecting) {
        let snapPos = pos, tId = null, tAnc = null;
        const target = findConnectTarget(pos, connecting.from);
        if (target) {
          const anchors = anchorCache.get(target.id) || getAnchors(target);
          const dists = anchors.map(a => Math.hypot(a.x - pos.x, a.y - pos.y));
          const idx = dists.indexOf(Math.min(...dists));
          snapPos = anchors[idx]; tId = target.id; tAnc = idx;
        }
        setConnecting(prev => prev ? ({ ...prev, current: snapPos, toNodeId: tId, toAnchor: tAnc }) : null);
      } else if (reconnecting) {
        let sPos = pos, tId = null, tAnc = null;
        const edge = edges.find(ed => ed.id === reconnecting.edgeId);
        const otherId = reconnecting.endpoint === 'from' ? edge?.to : edge?.from;
        const target = findConnectTarget(pos, otherId);
        if (target) {
          const anchors = anchorCache.get(target.id) || getAnchors(target);
          const dists = anchors.map(a => Math.hypot(a.x - pos.x, a.y - pos.y));
          const idx = dists.indexOf(Math.min(...dists));
          sPos = anchors[idx]; tId = target.id; tAnc = idx;
        }
        setReconnecting(prev => prev ? ({ ...prev, current: sPos, toNodeId: tId, toAnchor: tAnc }) : null);
      } else if (marquee) {
        setMarquee(m => m ? ({ ...m, end: pos }) : null);
        const x1 = Math.min(marquee.start.x, pos.x), x2 = Math.max(marquee.start.x, pos.x), y1 = Math.min(marquee.start.y, pos.y), y2 = Math.max(marquee.start.y, pos.y);
        setSelectedIds(nodes.filter(n => n.x < x2 && n.x + n.w > x1 && n.y < y2 && n.y + n.h > y1).map(n => n.id));
      }
    });
  };

  const handleMouseUp = (e) => {
    if (dragging) { 
      setNodes(ns => ns.map(n => ({ ...n, isDragging: false })));
      save(nodes, edges); 
      setDragging(null); 
    }
    if (resizing) { save(nodes, edges); setResizing(null); }
    if (connecting) {
      const pos = getPos(e);
      const target = findConnectTarget(pos, connecting.from);
      if (target && target.id !== connecting.from) {
        const anchors = anchorCache.get(target.id) || getAnchors(target);
        const dists = anchors.map(a => Math.hypot(a.x - pos.x, a.y - pos.y));
        const minD = Math.min(...dists);
        const anchorIdx = minD < 30 ? dists.indexOf(minD) : 0;

        const conn = activeConnector || mode.connectors[0];
        setEdges(es => {
          if (es.some(ed => (ed.from === connecting.from && ed.to === target.id) || (ed.from === target.id && ed.to === connecting.from))) return es;
          const next = [...es, { id: `e-${Date.now()}`, from: connecting.from, fromAnchor: connecting.fromAnchor, to: target.id, toAnchor: anchorIdx, ...conn }];
          save(nodes, next);
          return next;
        });
      }
      setConnecting(null);
      if (!isToolLocked) { setTool('select'); setActiveConnector(null); }
    }
    if (reconnecting) {
      const pos = getPos(e);
      const edge = edges.find(ed => ed.id === reconnecting.edgeId);
      const otherId = reconnecting.endpoint === 'from' ? edge?.to : edge?.from;
      const target = findConnectTarget(pos, otherId);
      if (target) {
        const anchors = anchorCache.get(target.id) || getAnchors(target);
        const dists = anchors.map(a => Math.hypot(a.x - pos.x, a.y - pos.y));
        const idx = dists.indexOf(Math.min(...dists));
        setEdges(es => {
          const next = es.map(ed => {
            if (ed.id !== reconnecting.edgeId) return ed;
            return reconnecting.endpoint === 'from' ? { ...ed, from: target.id, fromAnchor: idx } : { ...ed, to: target.id, toAnchor: idx };
          });
          save(nodes, next);
          return next;
        });
      }
      setReconnecting(null);
    }
    if (marquee) setMarquee(null);
    surfaceRectRef.current = surfaceRef.current.getBoundingClientRect();
  };

  const handleContextMenu = (e, target, category) => {
    e.preventDefault(); e.stopPropagation();
    const pos = { x: e.clientX, y: e.clientY };
    let items = [];

    if (category === 'edge') {
      const otherConns = mode.connectors.filter(c => c.type !== target.type);
      if (otherConns.length > 0) {
        items.push({ label: 'Change Type To', disabled: true });
        otherConns.forEach(c => {
          items.push({
            label: c.label,
            icon: <RefreshCw size={13}/>,
            action: () => {
              setEdges(prev => {
                const next = prev.map(ed => ed.id === target.id ? { id: ed.id, from: ed.from, fromAnchor: ed.fromAnchor, to: ed.to, toAnchor: ed.toAnchor, ...c } : ed);
                save(nodes, next);
                return next;
              });
            }
          });
        });
        items.push({ separator: true });
      }
      items.push({
        label: 'Reverse Direction',
        icon: <RotateCcw size={13}/>,
        action: () => {
          setEdges(prev => {
            const next = prev.map(ed => ed.id === target.id ? { ...ed, from: ed.to, fromAnchor: ed.toAnchor, to: ed.from, toAnchor: ed.fromAnchor } : ed);
            save(nodes, next);
            return next;
          });
        }
      });
      items.push({ separator: true });
      items.push({ label: 'Delete', icon: <Trash2 size={14}/>, danger: true, action: () => {
        const next = edges.filter(ex => ex.id !== target.id);
        setEdges(next); save(nodes, next);
      }});
    } else {
      let tgGroup = null;
      for (const group of Object.values(mode.replaceGroups)) {
        if (group.includes(target.type)) {
          tgGroup = group;
          break;
        }
      }

      const otherTypesInGroup = tgGroup ? tgGroup.filter(t => t !== target.type) : [];
      if (otherTypesInGroup.length > 0) {
        items.push({ label: 'Replace With', disabled: true });
        otherTypesInGroup.forEach(t => {
          const tmpl = mode.elements.find(el => el.type === t);
          if (!tmpl) return;
          items.push({
            label: tmpl.label,
            icon: <RefreshCw size={13}/>,
            action: () => {
              setNodes(prev => {
                const next = prev.map(n => n.id === target.id ? { ...n, type: tmpl.type } : n);
                save(next, edges);
                return next;
              });
            }
          });
        });
        items.push({ separator: true });
      }

      if (target.type !== 'start' && target.type !== 'end') {
        items.push({ 
          label: target.locked ? 'Unlock Position' : 'Lock Position', 
          icon: target.locked ? <Unlock size={14}/> : <Lock size={14}/>, 
          action: () => {
            const next = nodes.map(n => n.id === target.id ? { ...n, locked: !n.locked } : n);
            setNodes(next); save(next, edges);
            shortcutToast(target.locked ? '🔓 Unlocked' : '🔒 Locked');
          }
        });
        if (!target.locked) {
          items.push({ label: 'Edit Label', icon: <Edit3 size={14}/>, action: () => setInputNode(target.id) });
        }
      }
      items.push(
        { label: 'Duplicate', icon: <Copy size={14}/>, action: () => {
          const nn = { ...target, id: `n-${Date.now()}`, x: target.x+20, y: target.y+20 };
          const next = [...nodes, nn]; setNodes(next); save(next, edges);
        }},
        { label: 'Delete', icon: <Trash2 size={14}/>, danger: true, action: () => {
          const ns = nodes.filter(n => n.id !== target.id);
          const es = edges.filter(ex => ex.from !== target.id && ex.to !== target.id);
          setNodes(ns); setEdges(es); save(ns, es);
        }}
      );
    }
    setContextMenu({ pos, items });
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) containerRef.current.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  useEffect(() => {
    const handleFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  const shortcutToast = useCallback((msg) => {
    toast(msg, { duration: 1000, position: 'bottom-center', style: { borderRadius: '1.5rem', background: '#0f172a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.12em' } });
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key;
      const kl = key.toLowerCase();

      if (ctrl) {
        if (kl === 'a') { e.preventDefault(); setSelectedIds(nodes.map(n => n.id)); shortcutToast('⌘ Selected All'); return; }
        if (kl === 'z') { e.preventDefault(); if (e.shiftKey) { redo(); shortcutToast('↻ Redo'); } else { undo(); shortcutToast('↺ Undo'); } return; }
        if (kl === 'y') { e.preventDefault(); redo(); shortcutToast('↻ Redo'); return; }
        if (kl === 'c') {
          const sel = nodes.filter(n => selectedIds.includes(n.id));
          if (sel.length > 0) {
            e.preventDefault();
            const ids = new Set(sel.map(n => n.id));
            clipboardRef.current = { nodes: JSON.parse(JSON.stringify(sel)), edges: JSON.parse(JSON.stringify(edges.filter(ed => ids.has(ed.from) && ids.has(ed.to)))) };
            shortcutToast(`📋 Copied ${sel.length}`);
          }
          return;
        }
        if (kl === 'x') {
          const sel = nodes.filter(n => selectedIds.includes(n.id));
          if (sel.length > 0) {
            e.preventDefault();
            const ids = new Set(sel.map(n => n.id));
            clipboardRef.current = { nodes: JSON.parse(JSON.stringify(sel)), edges: JSON.parse(JSON.stringify(edges.filter(ed => ids.has(ed.from) && ids.has(ed.to)))) };
            const ns = nodes.filter(n => !selectedIds.includes(n.id));
            const es = edges.filter(ex => !selectedIds.includes(ex.id) && !selectedIds.includes(ex.from) && !selectedIds.includes(ex.to));
            setNodes(ns); setEdges(es); setSelectedIds([]); save(ns, es);
            shortcutToast(`✂️ Cut ${sel.length}`);
          }
          return;
        }
        if (kl === 'v') {
          const clip = clipboardRef.current;
          if (clip.nodes.length > 0) {
            e.preventDefault();
            const idMap = {};
            const nn = clip.nodes.map(n => { const nid = `n-${Date.now()}-${Math.random().toString(36).slice(2,6)}`; idMap[n.id] = nid; return { ...n, id: nid, x: n.x + 30, y: n.y + 30 }; });
            const ne = clip.edges.map(ed => ({ ...ed, id: `e-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, from: idMap[ed.from] || ed.from, to: idMap[ed.to] || ed.to }));
            const nxN = [...nodes, ...nn], nxE = [...edges, ...ne];
            setNodes(nxN); setEdges(nxE); setSelectedIds(nn.map(n => n.id)); save(nxN, nxE);
            clipboardRef.current = { nodes: clip.nodes.map(n => ({ ...n, x: n.x + 30, y: n.y + 30 })), edges: clip.edges };
            shortcutToast(`📌 Pasted ${nn.length}`);
          }
          return;
        }
        if (kl === 'd') {
          e.preventDefault();
          const sel = nodes.filter(n => selectedIds.includes(n.id));
          if (sel.length > 0) {
            const idMap = {};
            const nn = sel.map(n => { const nid = `n-${Date.now()}-${Math.random().toString(36).slice(2,6)}`; idMap[n.id] = nid; return { ...n, id: nid, x: n.x + 25, y: n.y + 25 }; });
            const ids = new Set(sel.map(n => n.id));
            const ne = edges.filter(ed => ids.has(ed.from) && ids.has(ed.to)).map(ed => ({ ...ed, id: `e-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, from: idMap[ed.from], to: idMap[ed.to] }));
            const nxN = [...nodes, ...nn], nxE = [...edges, ...ne];
            setNodes(nxN); setEdges(nxE); setSelectedIds(nn.map(n => n.id)); save(nxN, nxE);
            shortcutToast(`⧉ Duplicated ${nn.length}`);
          }
          return;
        }
        if (kl === 'l') {
          e.preventDefault();
          const sel = nodes.filter(n => selectedIds.includes(n.id));
          if (sel.length > 0) {
            const allLocked = sel.every(n => n.locked);
            const next = nodes.map(n => selectedIds.includes(n.id) ? { ...n, locked: !allLocked } : n);
            setNodes(next); save(next, edges);
            shortcutToast(allLocked ? '🔓 Unlocked Group' : '🔒 Locked Group');
          }
          return;
        }
        return;
      }

      if (key === 'Escape') {
        setTool('select'); setActiveConnector(null); setIsToolLocked(false);
        setConnecting(null); setReconnecting(null); setMarquee(null);
        setSelectedIds([]); setContextMenu(null); setShowShortcuts(false);
        return;
      }
      if (['Delete', 'Backspace'].includes(key) && selectedIds.length > 0) {
        e.preventDefault(); deleteSelected(); return;
      }
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key)) {
        const sel = nodes.filter(n => selectedIds.includes(n.id));
        if (sel.length > 0) {
          e.preventDefault();
          const step = e.shiftKey ? 20 : 5;
          const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
          const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
          const nxN = nodes.map(n => selectedIds.includes(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n);
          setNodes(nxN); save(nxN, edges);
        }
        return;
      }
      if (key === '?' || (e.shiftKey && kl === '/')) {
        setShowShortcuts(p => !p); return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [nodes, edges, selectedIds, save, deleteSelected, undo, redo, shortcutToast]);

  useEffect(() => {
    if (inputNode && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [inputNode]);

  if (!isEditable) {
    let rawGraph = { nodes: [], edges: [] };
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      rawGraph = parsed?.graph || parsed || { nodes: [], edges: [] };
    } catch(e) {}

    const viewNodes = rawGraph.nodes || [];
    const viewEdges = rawGraph.edges || [];

    let vbX = 0, vbY = 0, vbW = 800, vbH = 600;
    if (viewNodes.length > 0) {
      const minX = Math.min(...viewNodes.map(n => n.x)) - 60;
      const minY = Math.min(...viewNodes.map(n => n.y)) - 60;
      const maxX = Math.max(...viewNodes.map(n => n.x + n.w)) + 60;
      const maxY = Math.max(...viewNodes.map(n => n.y + n.h)) + 60;
      vbX = minX; vbY = minY; vbW = maxX - minX; vbH = maxY - minY;
      if (vbW < 400) { vbX -= (400 - vbW)/2; vbW = 400; }
      if (vbH < 300) { vbY -= (300 - vbH)/2; vbH = 300; }
    }

    return (
      <div ref={surfaceRef} className={`w-full ${isFullscreen ? 'h-full' : 'h-[550px]'} relative bg-transparent flex items-center justify-center overflow-hidden`}>
        <svg viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} className="w-full h-full drop-shadow-[0_0_15px_rgba(59,130,246,0.15)]" style={{ pointerEvents: 'none' }}>
          {viewNodes.filter(n => n.type === 'boundary').map(n => (
             <UMLErrorBoundary key={n.id}>
               <NodeShape node={n} isSelected={false} color={mode.color} />
             </UMLErrorBoundary>
          ))}
          <g>
            {viewEdges.map(e => <ConnectionLine key={e.id} edge={e} from={viewNodes.find(n => n.id === e.from)} to={viewNodes.find(n => n.id === e.to)} color={mode.color} isSelected={false} />)}
          </g>
          {viewNodes.filter(n => n.type !== 'boundary').map(n => (
             <UMLErrorBoundary key={n.id}>
               <NodeShape node={n} isSelected={false} color={mode.color} />
             </UMLErrorBoundary>
          ))}
        </svg>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`w-full ${isFullscreen ? 'h-full' : 'h-[550px]'} bg-[#0a0e1a] text-slate-900 dark:text-white flex flex-col select-none overflow-hidden ${isFullscreen ? '' : 'rounded-[1.5rem] border border-slate-300 dark:border-slate-700/40 shadow-[0_8px_40px_-8px_rgba(0,0,0,0.7),0_0_0_1px_rgba(30,41,59,0.2)] transition-all'}`}>
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-slate-300 dark:border-slate-700/30 bg-[#0d1224]/80 backdrop-blur-xl z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button type="button" onClick={undo} disabled={history.past.length <= 1} className="p-2 hover:bg-white/5 disabled:opacity-20 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 transition-all duration-200">
              <RotateCcw size={16} />
            </button>
            <button type="button" onClick={redo} disabled={history.future.length === 0} className="p-2 hover:bg-white/5 disabled:opacity-20 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 transition-all duration-200">
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="w-px h-5 bg-slate-700/40" />
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">
            <span className="tabular-nums">{history.past.length} steps</span>
            {history.future.length > 0 && <span className="text-indigo-400/80">+{history.future.length}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={clearCanvas} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-slate-300 dark:border-slate-700/30 hover:bg-rose-500/10 hover:border-rose-500/20 text-slate-500 hover:text-rose-400 text-[9px] font-bold uppercase tracking-wider transition-all duration-200">
            <Eraser size={13} />
            Clear
          </button>
          <button type="button" onClick={toggleFullscreen} className="p-2 rounded-lg bg-white/[0.03] border border-slate-300 dark:border-slate-700/30 hover:bg-indigo-500/10 hover:border-indigo-500/20 text-slate-500 hover:text-indigo-400 transition-all duration-200">
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-60 bg-[#0d1224]/60 backdrop-blur-xl border-r border-slate-300 dark:border-slate-700/25 flex flex-col z-20 shrink-0">
          <div className="px-4 py-3.5 border-b border-slate-300 dark:border-slate-700/25 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full shadow-[0_0_6px_1px] animate-pulse" style={{ backgroundColor: mode.color, boxShadow: `0 0 8px 2px ${mode.color}40` }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600 dark:text-slate-300">{diagramType}</span>
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                     className="w-full bg-white/[0.02] border border-slate-300 dark:border-slate-700/30 rounded-lg pl-9 pr-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400 placeholder:text-slate-600 focus:border-indigo-500/40 focus:bg-white/[0.04] outline-none transition-all duration-200" />
            </div>
          </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5 custom-scrollbar">
          <div className="space-y-2.5">
            <p className="text-[9px] font-bold text-slate-500/80 uppercase tracking-[0.15em] pl-1 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full" style={{ backgroundColor: mode.color, opacity: 0.6 }} />
              Elements
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {filteredElements.map(el => (
                <button type="button" key={el.type} onClick={() => {
                    const newNode = {
                      id: `n-${Date.now()}`,
                      type: el.type,
                      label: String(el.label || el.type),
                      w: el.w, h: el.h,
                      x: 300 + Math.random()*50, y: 150 + Math.random()*50
                    };
                    const next = [...nodes, newNode];
                    setNodes(next); setSelectedIds([newNode.id]); save(next, edges);
                }}
                        draggable
                        onDragStart={e => { e.dataTransfer.setData('application/reactflow', el.type); e.dataTransfer.effectAllowed = 'move'; }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/[0.02] border border-transparent hover:border-slate-300 dark:border-slate-700/40 hover:bg-white/[0.05] transition-all duration-200 group active:scale-[0.97] cursor-grab active:cursor-grabbing">
                  <div className="w-8 h-8 flex items-center justify-center bg-white/[0.03] rounded-md group-hover:scale-105 transition-transform border border-white/[0.04] shrink-0 overflow-hidden">
                    <ElementPreview type={el.type} color={mode.color} />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:text-slate-200 transition-colors">{el.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="text-[9px] font-bold text-slate-500/80 uppercase tracking-[0.15em] pl-1 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-indigo-400/50" />
              Relations
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {filteredConnectors.map(c => {
                const isActive = tool === 'connect' && activeConnector?.type === c.type;
                return (
                  <button type="button" key={c.type}
                          onClick={() => {
                            if (isActive) {
                              setTool('select'); setActiveConnector(null); setIsToolLocked(false);
                            } else {
                              setTool('connect'); setActiveConnector(c); setIsToolLocked(true);
                              setSelectedIds([]);
                            }
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg border transition-all duration-200 group ${isActive ? 'bg-indigo-500/20 border-indigo-400/50 ring-1 ring-indigo-400/30 text-slate-900 dark:text-white' : 'bg-white/[0.02] border-transparent text-slate-500 dark:text-slate-400 hover:bg-white/[0.05] hover:border-slate-300 dark:border-slate-700/40'}`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 flex items-center justify-center rounded-md bg-white/[0.03] border border-white/[0.04] shrink-0 overflow-hidden">
                        <ConnectorPreview connector={c} color={isActive ? '#fff' : mode.color} />
                      </div>
                      <span className="text-[10px] font-medium tracking-tight">{c.label}</span>
                    </div>
                    {isActive && isToolLocked && <RefreshCw size={11} className="opacity-50" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      <div ref={surfaceRef}
           className={`flex-1 relative bg-[#080c18] overflow-hidden ${dragging ? 'is-dragging' : ''} ${
             resizing ? (resizing.handle === 'top' || resizing.handle === 'bottom' ? 'cursor-ns-resize' : resizing.handle === 'left' || resizing.handle === 'right' ? 'cursor-ew-resize' : resizing.handle === 'top-left' || resizing.handle === 'bottom-right' ? 'cursor-nwse-resize' : 'cursor-nesw-resize') :
             dragging ? 'cursor-grabbing' : 
             (tool === 'connect' || connecting || reconnecting) ? 'cursor-crosshair canvas-connect-mode' : 
             'cursor-default'
           }`}
           style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)', userSelect: (dragging || resizing || marquee) ? 'none' : 'auto' }}
           onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseDown={handleMouseDown}
           onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
           onDrop={e => {
             e.preventDefault();
             const type = e.dataTransfer.getData('application/reactflow');
             if (!type) return;
             const tmpl = mode.elements.find(el => el.type === type);
             if (!tmpl) return;
             const pos = getPos(e);
             const nn = { ...tmpl, id: `n-${Date.now()}`, x: pos.x - tmpl.w/2, y: pos.y - tmpl.h/2, label: String(tmpl.label || tmpl.type) };
             const next = [...nodes, nn];
             setNodes(next); setSelectedIds([nn.id]); save(next, edges);
           }}>
        <svg className="w-full h-full" style={{ pointerEvents: 'none', fontFamily: 'Inter, Arial, sans-serif' }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="canvasDots" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="16" cy="16" r="0.8" fill="white" opacity="0.06" />
            </pattern>
          </defs>
<rect width="100%" height="100%" fill="url(#canvasDots)" />

          {marquee && (
            <rect x={Math.min(marquee.start.x, marquee.end.x)} y={Math.min(marquee.start.y, marquee.end.y)}
                  width={Math.abs(marquee.end.x - marquee.start.x)} height={Math.abs(marquee.end.y - marquee.start.y)}
                  fill="#3b82f615" stroke="#3b82f6" strokeWidth="1" strokeDasharray="5,3" />
          )}

          {/* LAYER 1: Boundaries (Bottom-most layer, container backdrop) */}
             {nodes
               .filter(n => n.type === 'boundary')
               .map(n => (
                 <UMLErrorBoundary key={n.id}>
                    <RenderedNode 
                      n={n} 
                      isSelected={selectedIds.includes(n.id)} 
                      isHovered={hoveredId === n.id} 
                      modeColor={mode.color}
                      onMouseDown={e => { e.stopPropagation(); handleMouseDown(e); }}
                      onDoubleClick={e => { e.stopPropagation(); setInputNode(n.id); }}
                      onContextMenu={e => handleContextMenu(e, n, 'node')}
                      tool={tool} inputNode={inputNode}
                      anchorCache={anchorCache} connecting={connecting} reconnecting={reconnecting}
                      getAnchors={getAnchors} getPos={getPos} setConnecting={setConnecting}
                    />
                 </UMLErrorBoundary>
               ))}

          {/* LAYER 2: Edges (Middle layer, association lines) */}
          <g style={{ pointerEvents: tool === 'connect' ? 'none' : 'auto' }}>
            {edges.map(e => (
               <UMLErrorBoundary key={e.id}>
                  <ConnectionLine
                    edge={e}
                    from={nodes.find(n => n.id === e.from)}
                    to={nodes.find(n => n.id === e.to)}
                    color={mode.color}
                    isSelected={selectedIds.includes(e.id)}
                    isHovered={hoveredId === e.id}
                    onMouseDown={ev => { ev.stopPropagation(); setSelectedIds(ev.shiftKey ? [...selectedIds, e.id] : [e.id]); }}
                    onContextMenu={ev => handleContextMenu(ev, e, 'edge')}
                    onEndpointDrag={(ev, endpoint) => setReconnecting({ edgeId: e.id, endpoint, current: getPos(ev) })}
                  />
               </UMLErrorBoundary>
            ))}
          </g>

          {/* LAYER 3: Functional Elements (Top-most layer, UseCase, Actors, Notes) */}
          <g>
            {nodes.map(n => {
              if (n.type === 'boundary') return null;
              return (
                 <UMLErrorBoundary key={`node-${n.id}`}>
                   <RenderedNode 
                     n={n} 
                     isSelected={selectedIds.includes(n.id)} 
                     isHovered={hoveredId === n.id} 
                     modeColor={mode.color}
                     onMouseDown={e => { e.stopPropagation(); handleMouseDown(e); }}
                     onDoubleClick={e => { e.stopPropagation(); if (n.type !== 'start' && n.type !== 'end') setInputNode(n.id); }}
                     onContextMenu={e => handleContextMenu(e, n, 'node')}
                     tool={tool} inputNode={inputNode}
                     anchorCache={anchorCache} connecting={connecting} reconnecting={reconnecting}
                     getAnchors={getAnchors} getPos={getPos} setConnecting={setConnecting}
                   />
                 </UMLErrorBoundary>
              );
            })}
          </g>

          {/* LAYER 4: Interaction Handles (Top-most Layer for absolute event priority) */}
          <g style={{ pointerEvents: 'auto' }}>
            {/* 4.1: Individual Node Handles */}
            {selectedIds.length === 1 && (() => {
              const n = nodes.find(x => x.id === selectedIds[0]);
              if (!n || dragging || resizing || n.locked) return null;
              return (
               <UMLErrorBoundary key={`handles-${n.id}`}>
                 <g>
                  {['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left'].map(h => {
                    let hx = isFinite(n.x) ? n.x : 0, hy = isFinite(n.y) ? n.y : 0;
                    const hw = isFinite(n.w) ? n.w : 50, hh = isFinite(n.h) ? n.h : 50;
                    if (h.includes('right')) hx += hw;
                    if (h.includes('bottom')) hy += hh;
                    if (h === 'top' || h === 'bottom') hx += hw/2;
                    if (h === 'left' || h === 'right') hy += hh/2;
                    const cursor = h === 'top' || h === 'bottom' ? 'ns-resize' : h === 'left' || h === 'right' ? 'ew-resize' : h === 'top-left' || h === 'bottom-right' ? 'nwse-resize' : 'nesw-resize';
                    return (
                      <g key={h} className="resize-handle-group">
                        <rect x={hx-5} y={hy-5} width={10} height={10} fill="white" stroke="#3b82f6" strokeWidth="2" rx="2" pointerEvents="none" />
                        <rect x={hx-12} y={hy-12} width={24} height={24} fill="transparent" cursor={cursor}
                              onMouseDown={(e) => { e.stopPropagation(); setResizing({ id: n.id, handle: h, startPos: getPos(e), nodeStart: {...n} }); }} />
                      </g>
                    );
                  })}
                 </g>
               </UMLErrorBoundary>
              );
            })()}

            {/* 4.2: Multi-Selection Bounding Box (Handles moved above elements) */}
            {(() => {
              const selNodes = nodes.filter(n => selectedIds.includes(n.id));
              if (selNodes.length < 2) return null;
              const pad = 12;
              const bx = Math.min(...selNodes.map(n => n.x)) - pad;
              const by = Math.min(...selNodes.map(n => n.y)) - pad;
              const bw = Math.max(...selNodes.map(n => n.x + n.w)) - bx + pad;
              const bh = Math.max(...selNodes.map(n => n.y + n.h)) - by + pad;
              const corners = [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]];
              return (
                <UMLErrorBoundary key="multi-selection-box">
                  <g style={{ pointerEvents: 'none' }}>
                    <rect x={bx} y={by} width={bw} height={bh} rx="8" fill="none" stroke="#3b82f6" strokeWidth="6" opacity="0.08" />
                    <rect x={bx} y={by} width={bw} height={bh} rx="8" fill="#3b82f606" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="8,5" opacity="0.6">
                      <animate attributeName="stroke-dashoffset" from="0" to="26" dur="1.5s" repeatCount="indefinite" />
                    </rect>
                    {corners.map(([cx, cy], i) => (
                      <circle key={i} cx={cx} cy={cy} r="3.5" fill="#3b82f6" stroke="#020617" strokeWidth="1.5" opacity="0.8" />
                    ))}
                    <g transform={`translate(${isFinite(bx + bw - 10) ? bx + bw - 10 : 0}, ${isFinite(by - 10) ? by - 10 : 0})`}>
                      <rect x="-12" y="-10" width="24" height="20" rx="10" fill="#3b82f6" />
                      <text x="0" y="4" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">{selNodes.length}</text>
                    </g>
                  </g>
                </UMLErrorBoundary>
              );
            })()}

            {/* 4.3: Connection Endpoint Handles */}
            {edges.filter(e => selectedIds.includes(e.id)).map(e => {
              const f = nodes.find(n => n.id === e.from);
              const t = nodes.find(n => n.id === e.to);
              if (!f || !t) return null;
              const a1 = getAnchors(f)[e.fromAnchor] || getAnchors(f)[0];
              const a2 = getAnchors(t)[e.toAnchor] || getAnchors(t)[0];
              return (
                <g key={`edge-handles-${e.id}`}>
                  <circle cx={a1.x} cy={a1.y} r="7" fill="#3b82f6" stroke="white" strokeWidth="1.5" className={`connection-handle ${reconnecting?.edgeId === e.id && reconnecting?.endpoint === 'from' ? 'dragging' : ''}`}
                          onMouseDown={ev => { ev.stopPropagation(); setReconnecting({ edgeId: e.id, endpoint: 'from', current: getPos(ev), toNodeId: e.to, toAnchor: e.toAnchor }); }} />
                  <circle cx={a2.x} cy={a2.y} r="7" fill="#3b82f6" stroke="white" strokeWidth="1.5" className={`connection-handle ${reconnecting?.edgeId === e.id && reconnecting?.endpoint === 'to' ? 'dragging' : ''}`}
                          onMouseDown={ev => { ev.stopPropagation(); setReconnecting({ edgeId: e.id, endpoint: 'to', current: getPos(ev), toNodeId: e.from, toAnchor: e.fromAnchor }); }} />
                </g>
              );
            })}
          </g>

          {/* Live connection preview line */}
          {connecting && (() => {
            const start = nodes.find(n => n.id === connecting.from);
            if (!start) return null;
            const fakeTo = { x: connecting.current.x, y: connecting.current.y, w: 0, h: 0 };
            const previewEdge = {
              id: 'preview',
              from: start.id,
              to: 'preview_to',
              fromAnchor: connecting.fromAnchor,
              toAnchor: 0,
              ...(activeConnector || mode.connectors[0])
            };
            return (
              <g opacity="0.5" style={{ pointerEvents: 'none' }}>
                <ConnectionLine
                  edge={previewEdge}
                  from={start}
                  to={fakeTo}
                  color={mode.color}
                  isSelected={true}
                />
              </g>
            );
          })()}

          {/* Reconnect preview line */}
          {reconnecting && (() => {
            const ed = edges.find(e => e.id === reconnecting.edgeId);
            if (!ed) return null;
            const from = nodes.find(n => n.id === ed.from);
            const to = nodes.find(n => n.id === ed.to);
            if (!from || !to) return null;
            
            const fakeNode = { x: reconnecting.current.x, y: reconnecting.current.y, w: 0, h: 0 };
            
            const previewEdge = {
              ...ed,
              id: 'reconnect_preview',
              from: reconnecting.endpoint === 'from' ? 'fake_from' : from.id,
              fromAnchor: reconnecting.endpoint === 'from' ? 0 : ed.fromAnchor,
              to: reconnecting.endpoint === 'to' ? 'fake_to' : to.id,
              toAnchor: reconnecting.endpoint === 'to' ? 0 : ed.toAnchor
            };

            return (
              <g opacity="0.5" style={{ pointerEvents: 'none' }}>
                <ConnectionLine
                  edge={previewEdge}
                  from={reconnecting.endpoint === 'from' ? fakeNode : from}
                  to={reconnecting.endpoint === 'to' ? fakeNode : to}
                  color={mode.color}
                  isSelected={true}
                />
              </g>
            );
          })()}
        </svg>

        {/* Global Delete Zone (Top Center) for Connections */}
        {selectedIds.length > 0 && nodes.filter(n => selectedIds.includes(n.id)).length === 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 duration-300">
             <button
               type="button"
               onClick={deleteSelected}
               className="flex items-center gap-3 px-6 py-3 bg-rose-600/90 hover:bg-rose-500 backdrop-blur-xl text-slate-900 dark:text-white rounded-full shadow-[0_8px_32px_rgba(225,29,72,0.4)] border border-rose-400/30 transition-all hover:scale-105 active:scale-95 group"
             >
               <Trash2 size={18} className="group-hover:rotate-12 transition-transform" />
               <span className="text-[10px] font-black uppercase tracking-[0.2em]">Remove Connection</span>
             </button>
          </div>
        )}

        {/* Floating Action Bar (Nodes Only) */}
        {selectedIds.length > 0 && (() => {
          const selectedNodes = nodes.filter(n => selectedIds.includes(n.id));
          if (selectedNodes.length === 0) return null;

          const minX = Math.min(...selectedNodes.map(b => b.x));
          const maxX = Math.max(...selectedNodes.map(b => b.x + b.w));
          const minY = Math.min(...selectedNodes.map(b => b.y));

          const isDraggingOrBusy = !!(dragging || resizing || reconnecting);

          return (
            <div className="floating-actions absolute z-50 pointer-events-none"
                 style={{
                   left: (minX + maxX) / 2,
                   top: Math.max(10, minY - 52),
                   transform: 'translateX(-50%)',
                   opacity: isDraggingOrBusy ? 0 : 1,
                   transition: isDraggingOrBusy ? 'none' : 'opacity 0.15s ease',
                   willChange: 'left, top',
                 }}>
              <div className="flex gap-0.5 p-1 bg-[#0d1224]/95 backdrop-blur-xl border border-slate-300 dark:border-slate-700/40 rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.6)] pointer-events-auto"
                   onMouseDown={e => e.stopPropagation()}>
                {selectedNodes.length === 1 && (
                  <>
                    <button type="button" 
                            onClick={() => {
                              const next = nodes.map(n => n.id === selectedNodes[0].id ? { ...n, locked: !n.locked } : n);
                              setNodes(next); save(next, edges);
                              shortcutToast(selectedNodes[0].locked ? '🔓 Unlocked' : '🔒 Locked');
                            }} 
                            className={`p-1.5 hover:bg-white/[0.06] rounded-md transition-colors duration-150 ${selectedNodes[0].locked ? 'text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}
                            title={selectedNodes[0].locked ? 'Unlock' : 'Lock'}>
                      {selectedNodes[0].locked ? <Unlock size={15} /> : <Lock size={15} />}
                    </button>
                    {!selectedNodes[0].locked && selectedNodes[0].type !== 'start' && selectedNodes[0].type !== 'end' && (
                      <button type="button" onClick={() => setInputNode(selectedIds[0])} className="p-1.5 hover:bg-white/[0.06] rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 transition-colors duration-150">
                        <Edit3 size={15} />
                      </button>
                    )}
                    <div className="w-px h-6 bg-slate-700/30 my-auto" />
                  </>
                )}
                <button type="button" onClick={deleteSelected} className="p-1.5 hover:bg-rose-500/10 rounded-md text-rose-400/70 hover:text-rose-400 transition-colors duration-150">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })()}

        {/* Label Editor */}
        {inputNode && (() => {
          const n = nodes.find(x => x.id === inputNode);
          if (!n) return null;
          
          const nx = isFinite(n.x) ? n.x : 0;
          const ny = isFinite(n.y) ? n.y : 0;
          const nw = isFinite(n.w) ? n.w : 50;
          const nh = isFinite(n.h) ? n.h : 50;
          const tpos = { 
            x: nx + nw / 2, 
            y: n.type === 'actor' || n.type === 'start' || n.type === 'end' ? ny + nh + 18 : 
               n.type === 'boundary' ? ny + 28 : ny + nh / 2 
          };

          if (n.type === 'class' || n.type === 'interface') {
             const parts = n.label.split('---').map(p => p.trim());
             const updatePart = (idx, val) => {
                const pp = (parts.length < 3) ? [parts[0] || '', parts[1] || '', parts[2] || ''] : [...parts];
                pp[idx] = val;
                setNodes(ns => ns.map(x => x.id === n.id ? { ...x, label: pp.join('\n---\n') } : x));
             };
             
             const handleKeyPress = (e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.target.tagName === 'INPUT')) {
                   e.preventDefault();
                   setInputNode(null);
                   save(nodes, edges);
                }
             };

             return (
               <div className="absolute p-4 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-[2rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] z-[9999] flex flex-col gap-4 min-w-[260px] animate-in zoom-in-95 duration-200"
                    style={{ left: tpos.x, top: tpos.y, transform: 'translate(-50%, 0)' }}
                    onMouseDown={e => e.stopPropagation()}
                    onKeyDown={handleKeyPress}>
                 <div className="space-y-1.5">
                   <label className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest pl-1">
                     <Type size={12} /> Class Identity
                   </label>
                   <input autoFocus className="w-full bg-white dark:bg-slate-950/50 text-slate-900 dark:text-white px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500 transition-all text-sm font-bold"
                          placeholder="Name..."
                          value={parts[0] || ''} onChange={e => updatePart(0, e.target.value)} />
                 </div>
                 <div className="space-y-1.5">
                   <label className="flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest pl-1">
                     <GripHorizontal size={12} /> Attributes
                   </label>
                   <textarea className="w-full bg-white dark:bg-slate-950/50 text-slate-900 dark:text-white px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:border-emerald-500 transition-all text-xs resize-none"
                             rows={3} placeholder="+ attr: type"
                             value={parts[1] || ''} onChange={e => updatePart(1, e.target.value)} />
                 </div>
                 <div className="space-y-1.5">
                   <label className="flex items-center gap-2 text-[10px] font-black text-amber-400 uppercase tracking-widest pl-1">
                     <RefreshCw size={12} /> Operations
                   </label>
                   <textarea className="w-full bg-white dark:bg-slate-950/50 text-slate-900 dark:text-white px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:border-amber-500 transition-all text-xs resize-none"
                             rows={3} placeholder="+ method(): void"
                             value={parts[2] || ''} onChange={e => updatePart(2, e.target.value)} />
                 </div>
                 <button onClick={() => { setInputNode(null); save(nodes, edges); }}
                         className="mt-2 w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
                    Apply Changes
                 </button>
               </div>
             );
          }

          return <DiagramTextEditor n={n} tpos={tpos} inputRef={inputRef} setNodes={setNodes} setInputNode={setInputNode} save={save} nodes={nodes} edges={edges} inputNode={inputNode} />;
        })()}

        {/* Context Menu */}
        {contextMenu && (
          <div className="fixed bg-[#0d1224]/95 border border-slate-300 dark:border-slate-700/40 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.7)] rounded-xl p-1.5 min-w-[190px] z-[99999] animate-in zoom-in-95 backdrop-blur-xl"
               style={{ left: contextMenu.pos.x, top: contextMenu.pos.y }}
               onMouseDown={e => e.stopPropagation()}
               onContextMenu={e => e.preventDefault()}>
            {contextMenu.items.map((it, i) => it.separator ? (
              <div key={i} className="h-px bg-slate-700/30 my-1.5 mx-1"/>
            ) : it.disabled ? (
              <p key={i} className="px-3 py-1.5 text-[9px] font-bold text-slate-500/70 uppercase tracking-widest">{it.label}</p>
            ) : (
              <button type="button" key={i} onClick={() => { it.action?.(); setContextMenu(null); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${it.danger?'text-rose-400/80 hover:bg-rose-500/10 hover:text-rose-400':'text-slate-600 dark:text-slate-300 hover:bg-white/[0.06] hover:text-slate-900 dark:text-white'}`}>
                {it.label} {it.icon}
              </button>
            ))}
          </div>
        )}

        {/* Shortcuts Help Panel */}
        <button type="button" onClick={() => setShowShortcuts(p => !p)}
                className="shortcuts-help-btn absolute bottom-3 right-3 z-50 w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800/80 backdrop-blur border border-slate-300 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-700/80 transition-all text-xs font-bold shadow-lg"
                title="Keyboard Shortcuts (?)">?</button>

        {showShortcuts && (
          <div className="shortcuts-panel absolute bottom-12 right-3 z-[9999] w-[280px] bg-[#0b1022]/95 backdrop-blur-2xl border border-slate-300 dark:border-slate-700/50 rounded-2xl shadow-[0_20px_60px_-12px_rgba(0,0,0,0.8)] p-4 animate-in slide-in-from-bottom-4 zoom-in-95 duration-200"
               onMouseDown={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-[0.15em]">⌨ Shortcuts</h3>
              <button type="button" onClick={() => setShowShortcuts(false)} className="text-slate-500 hover:text-slate-900 dark:text-white transition-colors"><XCircle size={14} /></button>
            </div>
            {[
              { title: 'Selection', items: [['Ctrl + A','Select All'],['Click','Select'],['Shift + Click','Multi-select'],['Esc','Deselect']] },
              { title: 'Clipboard', items: [['Ctrl + C','Copy'],['Ctrl + V','Paste'],['Ctrl + X','Cut'],['Ctrl + D','Duplicate']] },
              { title: 'Edit', items: [['Del / ⌫','Delete'],['Ctrl + Z','Undo'],['Ctrl + Y','Redo']] },
              { title: 'Move', items: [['↑ ↓ ← →','Nudge 5px'],['Shift + Arrow','Nudge 20px']] },
              { title: 'Other', items: [['Double-click','Edit label'],['Right-click','Context menu'],['Drag from sidebar','Add element'],['Ctrl + L', 'Lock/Unlock']] },
            ].map(group => (
              <div key={group.title} className="mb-2.5">
                <p className="text-[8px] font-black text-indigo-400/80 uppercase tracking-[0.2em] mb-1">{group.title}</p>
                <div className="space-y-0.5">
                  {group.items.map(([keys, desc]) => (
                    <div key={keys} className="flex items-center justify-between py-[3px]">
                      <span className="text-[9px] text-slate-500 dark:text-slate-400">{desc}</span>
                      <kbd className="text-[8px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700/60 rounded px-1.5 py-0.5">{keys}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-[8px] text-slate-600 text-center mt-2">Press <kbd className="font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-1">?</kbd> to toggle</p>
          </div>
        )}
      </div>
    </div>
  </div>
);
};

export default UMLCanvas;
