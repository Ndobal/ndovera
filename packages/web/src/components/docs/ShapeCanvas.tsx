import React, { useEffect, useRef } from 'react';
import * as fabric from 'fabric';

export const ShapeCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Create new fabric instance on the canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: false,
      selection: true,
    });

    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      width: 100,
      height: 60,
      fill: 'transparent',
      stroke: 'black',
      strokeWidth: 2,
      cornerColor: 'blue',
      borderColor: 'blue',
      transparentCorners: false
    });

    canvas.add(rect);

    // Provide a simple teardown
    return () => {
      canvas.dispose();
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none z-10 p-[60px]" style={{ width: '794px', minHeight: '1123px' }}>
      <canvas 
        ref={canvasRef} 
        width="674" 
        height="1003" 
        className="pointer-events-auto"
      />
    </div>
  );
};
