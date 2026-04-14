import React from 'react';
import { useDrop } from 'react-dnd';

interface DroppableStageColumnProps {
  stageId: string;
  onDropDeal: (dealId: string, stageId: string) => void;
  children: React.ReactNode;
  className?: string;
}

export const DroppableStageColumn = ({ stageId, onDropDeal, children, className }: DroppableStageColumnProps) => {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'DEAL',
    drop: (item: { id: string, stageId: string }) => {
        if (item.stageId !== stageId) {
            onDropDeal(item.id, stageId);
        }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
  }), [stageId, onDropDeal]);

  return (
    <div 
        ref={drop} 
        className={`${className} ${isOver ? 'ring-2 ring-blue-400 bg-blue-50/50' : ''} transition-all duration-200`}
    >
      {children}
    </div>
  );
};