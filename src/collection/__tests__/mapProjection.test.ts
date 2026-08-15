import { projectPoints } from '../mapProjection';

describe('projectPoints', () => {
  it('returns an empty array for no input', () => {
    expect(projectPoints([])).toEqual([]);
  });

  it('centers a single point', () => {
    expect(projectPoints([{ lat: 35.6, lng: 139.7 }])).toEqual([{ x: 0.5, y: 0.5 }]);
  });

  it('maps the bounding box corners to 0/1 with north at the top', () => {
    const points = projectPoints([
      { lat: 35.0, lng: 139.0 }, // south-west
      { lat: 36.0, lng: 140.0 }, // north-east
    ]);
    expect(points).toEqual([
      { x: 0, y: 1 }, // south -> bottom
      { x: 1, y: 0 }, // north -> top
    ]);
  });

  it('centers points that share an axis instead of dividing by zero', () => {
    const points = projectPoints([
      { lat: 35.0, lng: 139.0 },
      { lat: 35.0, lng: 140.0 },
    ]);
    expect(points[0].y).toBe(0.5);
    expect(points[1].y).toBe(0.5);
  });
});
