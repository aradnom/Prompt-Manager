interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface LayoutItem extends Rect {
  id: string | number
}

function checkCollision(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  )
}

function getDepenetrationVector(a: Rect, b: Rect): { dx: number; dy: number } {
  // Calculate overlap on each axis
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)

  // Use the smaller overlap to determine separation direction
  if (overlapX < overlapY) {
    // Separate horizontally
    const direction = a.x < b.x ? -1 : 1
    return { dx: direction * overlapX / 2, dy: 0 }
  } else {
    // Separate vertically
    const direction = a.y < b.y ? -1 : 1
    return { dx: 0, dy: direction * overlapY / 2 }
  }
}

interface CalculatePositionsParams {
  count: number
  centerX: number
  centerY: number
  centerWidth: number
  centerHeight: number
  itemWidth: number
  itemHeight: number
  radius: number
  margin?: number
  maxIterations?: number
}

export function calculateNonOverlappingPositions({
  count,
  centerX,
  centerY,
  centerWidth,
  centerHeight,
  itemWidth,
  itemHeight,
  radius,
  margin = 0,
  maxIterations = 50,
}: CalculatePositionsParams): Array<{ x: number; y: number }> {
  // Step 1: Calculate initial positions in a circle
  const items: LayoutItem[] = []

  for (let i = 0; i < count; i++) {
    const angle = (i * 360 / count) - 90 // Start from top
    const x = centerX + Math.cos(angle * Math.PI / 180) * radius
    const y = centerY + Math.sin(angle * Math.PI / 180) * radius

    items.push({
      id: i,
      x: x - itemWidth / 2,
      y: y - itemHeight / 2,
      width: itemWidth,
      height: itemHeight,
    })
  }

  // Center rectangle
  const center: Rect = {
    x: centerX - centerWidth / 2,
    y: centerY - centerHeight / 2,
    width: centerWidth,
    height: centerHeight,
  }

  // Step 2: Iteratively resolve collisions
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let hadCollision = false

    // Check collisions with center (with margin)
    for (const item of items) {
      const expandedItem = {
        x: item.x - margin / 2,
        y: item.y - margin / 2,
        width: item.width + margin,
        height: item.height + margin,
      }
      const expandedCenter = {
        x: center.x - margin / 2,
        y: center.y - margin / 2,
        width: center.width + margin,
        height: center.height + margin,
      }

      if (checkCollision(expandedItem, expandedCenter)) {
        hadCollision = true
        const vector = getDepenetrationVector(expandedItem, expandedCenter)
        item.x += vector.dx
        item.y += vector.dy
      }
    }

    // Check collisions between items (with margin)
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const expandedI = {
          x: items[i].x - margin / 2,
          y: items[i].y - margin / 2,
          width: items[i].width + margin,
          height: items[i].height + margin,
        }
        const expandedJ = {
          x: items[j].x - margin / 2,
          y: items[j].y - margin / 2,
          width: items[j].width + margin,
          height: items[j].height + margin,
        }

        if (checkCollision(expandedI, expandedJ)) {
          hadCollision = true
          const vector = getDepenetrationVector(expandedI, expandedJ)
          items[i].x += vector.dx
          items[i].y += vector.dy
          items[j].x -= vector.dx
          items[j].y -= vector.dy
        }
      }
    }

    if (!hadCollision) {
      break
    }
  }

  // Return final positions
  return items.map(item => ({
    x: item.x + itemWidth / 2,
    y: item.y + itemHeight / 2,
  }))
}
