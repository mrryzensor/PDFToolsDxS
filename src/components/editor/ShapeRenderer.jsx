import React from 'react';

/**
 * Generates an SVG path for regular or convex polygon with N sides
 */
function getPolygonPoints(sides, radius, cx, cy) {
  const points = [];
  const angleStep = (2 * Math.PI) / sides;
  // Offset by -PI/2 so the polygon points upward
  const startAngle = -Math.PI / 2;

  for (let i = 0; i < sides; i++) {
    const angle = startAngle + i * angleStep;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    points.push(`${x},${y}`);
  }
  return points.join(' ');
}

/**
 * Generates an SVG star with N points
 */
function getStarPoints(points, outerRadius, innerRadius, cx, cy) {
  const results = [];
  const step = Math.PI / points;
  let angle = -Math.PI / 2;

  for (let i = 0; i < 2 * points; i++) {
    const r = (i % 2 === 0) ? outerRadius : innerRadius;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    results.push(`${x},${y}`);
    angle += step;
  }
  return results.join(' ');
}

export const ShapeRenderer = ({ 
  shapeType = 'rectangle', 
  sides = 5, 
  width = 140, 
  height = 140, 
  fill = '#eaedff', 
  stroke = '#004ac6', 
  strokeWidth = 2,
  className = ''
}) => {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - strokeWidth;

  const renderShape = () => {
    switch (shapeType) {
      case 'rectangle':
        return (
          <rect 
            x={strokeWidth} 
            y={strokeWidth} 
            width={width - strokeWidth * 2} 
            height={height - strokeWidth * 2} 
            rx="8" 
            ry="8"
            fill={fill} 
            stroke={stroke} 
            strokeWidth={strokeWidth} 
          />
        );

      case 'circle':
      case 'ellipse':
        return (
          <ellipse 
            cx={cx} 
            cy={cy} 
            rx={width / 2 - strokeWidth} 
            ry={height / 2 - strokeWidth} 
            fill={fill} 
            stroke={stroke} 
            strokeWidth={strokeWidth} 
          />
        );

      case 'diamond': // Rombo
        return (
          <polygon 
            points={`${cx},${strokeWidth} ${width - strokeWidth},${cy} ${cx},${height - strokeWidth} ${strokeWidth},${cy}`} 
            fill={fill} 
            stroke={stroke} 
            strokeWidth={strokeWidth} 
          />
        );

      case 'triangle':
        return (
          <polygon 
            points={`${cx},${strokeWidth} ${width - strokeWidth},${height - strokeWidth} ${strokeWidth},${height - strokeWidth}`} 
            fill={fill} 
            stroke={stroke} 
            strokeWidth={strokeWidth} 
          />
        );

      case 'arrow-right':
        return (
          <path 
            d={`M ${strokeWidth} ${cy - height*0.15} L ${width * 0.6} ${cy - height*0.15} L ${width * 0.6} ${strokeWidth} L ${width - strokeWidth} ${cy} L ${width * 0.6} ${height - strokeWidth} L ${width * 0.6} ${cy + height*0.15} L ${strokeWidth} ${cy + height*0.15} Z`}
            fill={fill} 
            stroke={stroke} 
            strokeWidth={strokeWidth} 
          />
        );

      case 'arrow-double':
        return (
          <path 
            d={`M ${strokeWidth} ${cy} L ${width * 0.25} ${strokeWidth} L ${width * 0.25} ${cy - height*0.15} L ${width * 0.75} ${cy - height*0.15} L ${width * 0.75} ${strokeWidth} L ${width - strokeWidth} ${cy} L ${width * 0.75} ${height - strokeWidth} L ${width * 0.75} ${cy + height*0.15} L ${width * 0.25} ${cy + height*0.15} L ${width * 0.25} ${height - strokeWidth} Z`}
            fill={fill} 
            stroke={stroke} 
            strokeWidth={strokeWidth} 
          />
        );

      case 'star':
        return (
          <polygon 
            points={getStarPoints(sides || 5, radius, radius * 0.45, cx, cy)} 
            fill={fill} 
            stroke={stroke} 
            strokeWidth={strokeWidth} 
          />
        );

      case 'polygon': // Polígono convexo regular de N lados
      case 'hexagon':
      case 'pentagon':
      case 'octagon': {
        const nSides = shapeType === 'hexagon' ? 6 : shapeType === 'pentagon' ? 5 : shapeType === 'octagon' ? 8 : (sides || 5);
        return (
          <polygon 
            points={getPolygonPoints(nSides, radius, cx, cy)} 
            fill={fill} 
            stroke={stroke} 
            strokeWidth={strokeWidth} 
          />
        );
      }

      default:
        return (
          <rect 
            x={strokeWidth} 
            y={strokeWidth} 
            width={width - strokeWidth * 2} 
            height={height - strokeWidth * 2} 
            rx="6" 
            fill={fill} 
            stroke={stroke} 
            strokeWidth={strokeWidth} 
          />
        );
    }
  };

  return (
    <svg 
      width={width} 
      height={height} 
      viewBox={`0 0 ${width} ${height}`} 
      className={`overflow-visible select-none pointer-events-none ${className}`}
    >
      {renderShape()}
    </svg>
  );
};
