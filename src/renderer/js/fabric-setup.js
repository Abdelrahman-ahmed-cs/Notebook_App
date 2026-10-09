// Global Fabric.js configuration: control styling, custom object types, filter backend.
const { fabric } = window;

fabric.Object.NUM_FRACTION_DIGITS = 3;
fabric.filterBackend = new fabric.Canvas2dFilterBackend();
fabric.textureSize = 4096;

// Rotation handle sits 22px above the top edge on a thin stem (GoodNotes / Fluent style).
const ctrls = fabric.Object.prototype.controls;
ctrls.mtr.offsetY = -22;
ctrls.mtr.withConnection = true;
ctrls.mtr.cursorStyle = 'grab';
ctrls.mtr.render = function renderRotate(ctx, left, top, _style, obj) {
  ctx.save();
  ctx.translate(left, top);
  ctx.beginPath();
  ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = obj.borderColor || '#0f6cbd';
  ctx.lineWidth = 1;
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 2;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.restore();
};

// Edge handles render as short pills (Canva-style) so they read differently from corners.
function pill(horizontal) {
  return function renderPill(ctx, left, top, _style, obj) {
    const w = horizontal ? 16 : 5;
    const h = horizontal ? 5 : 16;
    const angle = fabric.util.degreesToRadians(obj.angle || 0);
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(angle);
    ctx.beginPath();
    const r = 2.5;
    ctx.moveTo(-w / 2 + r, -h / 2);
    ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, r);
    ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, r);
    ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r);
    ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = obj.borderColor || '#0f6cbd';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 2;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
  };
}
ctrls.mt.render = pill(true);
ctrls.mb.render = pill(true);
ctrls.ml.render = pill(false);
ctrls.mr.render = pill(false);

// Textbox uses its own control set (only side handles change width).
const tctrls = fabric.Textbox.prototype.controls;
tctrls.mtr = ctrls.mtr;
tctrls.ml.render = pill(false);
tctrls.mr.render = pill(false);

fabric.Object.prototype.objectCaching = true;

fabric.Textbox.prototype.splitByGrapheme = false;
fabric.IText.prototype.cursorColor = '#0f6cbd';
fabric.IText.prototype.selectionColor = 'rgba(15,108,189,0.22)';
fabric.IText.prototype.editingBorderColor = '#0f6cbd';

// ---------- Sticky note: a textbox with a padded paper background ----------
fabric.Sticky = fabric.util.createClass(fabric.Textbox, {
  type: 'sticky',
  stickyColor: '#fff2a8',
  stickyPad: 14,
  initialize(text, options) {
    this.callSuper('initialize', text, options);
    this.padding = this.stickyPad;
  },
  _renderBackground(ctx) {
    const p = this.stickyPad;
    const w = this.width + p * 2;
    const h = this.height + p * 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.16)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = this.stickyColor;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
    // folded corner
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 16, h / 2);
    ctx.lineTo(w / 2, h / 2 - 16);
    ctx.lineTo(w / 2, h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
  toObject(props) {
    return this.callSuper('toObject', ['stickyColor', 'stickyPad'].concat(props || []));
  },
});
fabric.Sticky.fromObject = function fromObject(object, callback) {
  const styles = fabric.util.stylesFromArray(object.styles, object.text);
  const copy = { ...object, styles };
  return fabric.Object._fromObject('Sticky', copy, callback, 'text');
};

export default fabric;
