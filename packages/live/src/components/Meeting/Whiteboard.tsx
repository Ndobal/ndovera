import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Rect, Circle } from 'react-konva';
import { 
  Pencil, 
  Square, 
  Circle as CircleIcon, 
  Eraser, 
  Trash2, 
  Download,
  Undo2,
  Type
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface Shape {
  id: string;
  type: 'pencil' | 'rect' | 'circle';
  points?: number[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  color: string;
  strokeWidth: number;
}

export const Whiteboard = () => {
  const [tool, setTool] = useState<'pencil' | 'rect' | 'circle' | 'eraser'>('pencil');
  const [color, setColor] = useState('#0ea5e9');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [undoStack, setUndoStack] = useState<Shape[][]>([]);
  const isDrawing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const handleMouseDown = (e: any) => {
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    
    setUndoStack(prev => [...prev, shapes]);

    const newShape: Shape = {
      id: Date.now().toString(),
      type: tool === 'eraser' ? 'pencil' : tool,
      color: tool === 'eraser' ? '#050505' : color, // Match bg for eraser
      strokeWidth: tool === 'eraser' ? strokeWidth * 4 : strokeWidth,
      points: [pos.x, pos.y],
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
      radius: 0
    };

    setShapes([...shapes, newShape]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current) return;

    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    let lastShape = shapes[shapes.length - 1];

    if (lastShape.type === 'pencil') {
      lastShape.points = lastShape.points!.concat([point.x, point.y]);
    } else if (lastShape.type === 'rect') {
      lastShape.width = point.x - lastShape.x!;
      lastShape.height = point.y - lastShape.y!;
    } else if (lastShape.type === 'circle') {
      const dx = point.x - lastShape.x!;
      const dy = point.y - lastShape.y!;
      lastShape.radius = Math.sqrt(dx * dx + dy * dy);
    }

    setShapes(shapes.slice(0, -1).concat([lastShape]));
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setShapes(previous);
    setUndoStack(undoStack.slice(0, -1));
  };

  const handleClear = () => {
    setUndoStack(prev => [...prev, shapes]);
    setShapes([]);
  };

  const handleDownload = () => {
    const uri = (containerRef.current?.querySelector('canvas') as HTMLCanvasElement)?.toDataURL();
    const link = document.createElement('a');
    link.download = 'whiteboard.png';
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const colors = [
    '#0ea5e9', // Brand Blue
    '#ef4444', // Red
    '#22c55e', // Green
    '#eab308', // Yellow
    '#ffffff', // White
    '#a855f7', // Purple
  ];

  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <ToolButton 
            icon={Pencil} 
            active={tool === 'pencil'} 
            onClick={() => setTool('pencil')} 
            label="Pencil"
          />
          <ToolButton 
            icon={Square} 
            active={tool === 'rect'} 
            onClick={() => setTool('rect')} 
            label="Rectangle"
          />
          <ToolButton 
            icon={CircleIcon} 
            active={tool === 'circle'} 
            onClick={() => setTool('circle')} 
            label="Circle"
          />
          <ToolButton 
            icon={Eraser} 
            active={tool === 'eraser'} 
            onClick={() => setTool('eraser')} 
            label="Eraser"
          />
          <div className="w-[1px] h-6 bg-white/10 mx-2" />
          <ToolButton 
            icon={Undo2} 
            onClick={handleUndo} 
            disabled={undoStack.length === 0}
            label="Undo"
          />
          <ToolButton 
            icon={Trash2} 
            onClick={handleClear} 
            label="Clear All"
            danger
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            {colors.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-all",
                  color === c ? "border-white scale-110" : "border-transparent hover:scale-105"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="w-[1px] h-6 bg-white/10" />
          <ToolButton 
            icon={Download} 
            onClick={handleDownload} 
            label="Export"
          />
        </div>
      </div>

      {/* Canvas Area */}
      <div ref={containerRef} className="flex-1 relative cursor-crosshair touch-none">
        <Stage
          width={dimensions.width}
          height={dimensions.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        >
          <Layer>
            {shapes.map((shape) => {
              if (shape.type === 'pencil') {
                return (
                  <Line
                    key={shape.id}
                    points={shape.points}
                    stroke={shape.color}
                    strokeWidth={shape.strokeWidth}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    globalCompositeOperation={
                      shape.color === '#050505' ? 'destination-out' : 'source-over'
                    }
                  />
                );
              } else if (shape.type === 'rect') {
                return (
                  <Rect
                    key={shape.id}
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    stroke={shape.color}
                    strokeWidth={shape.strokeWidth}
                  />
                );
              } else if (shape.type === 'circle') {
                return (
                  <Circle
                    key={shape.id}
                    x={shape.x}
                    y={shape.y}
                    radius={shape.radius}
                    stroke={shape.color}
                    strokeWidth={shape.strokeWidth}
                  />
                );
              }
              return null;
            })}
          </Layer>
        </Stage>
      </div>
    </div>
  );
};

const ToolButton = ({ icon: Icon, active, onClick, disabled, label, danger }: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "p-2.5 rounded-xl transition-all relative group",
      active ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20" : "text-white/40 hover:text-white hover:bg-white/5",
      disabled && "opacity-20 cursor-not-allowed",
      danger && "hover:bg-red-500/10 hover:text-red-500"
    )}
    title={label}
  >
    <Icon size={18} />
    <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-white/10">
      {label}
    </span>
  </button>
);
