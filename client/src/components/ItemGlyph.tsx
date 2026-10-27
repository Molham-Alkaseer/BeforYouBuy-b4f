import Icon, { type IconName } from "./Icon";

export default function ItemGlyph({
  name = "",
  category = "",
  tone = "",
}: {
  name?: string;
  category?: string;
  tone?: string;
}) {
  const text = `${name} ${category}`.toLowerCase();
  let icon: IconName = "box";
  if (/milk|dairy|cheese|yoghurt/.test(text)) icon = "milk";
  if (/coffee|tea|drink|juice/.test(text)) icon = "coffee";
  if (/rice|grain|pasta|lentil|bread/.test(text)) icon = "grain";
  if (/produce|spinach|vegetable|salad|tomato/.test(text)) icon = "leaf";
  if (/apple|fruit|banana/.test(text)) icon = "apple";
  if (/meat|fish|chicken/.test(text)) icon = "meat";
  if (/frozen/.test(text)) icon = "snow";
  if (/egg/.test(text)) icon = "egg";
  if (/manual/.test(category.toLowerCase())) icon = "tag";
  return (
    <span className={`item-glyph ${tone ? `tone-${tone}` : ""}`}>
      <Icon name={icon} />
    </span>
  );
}
