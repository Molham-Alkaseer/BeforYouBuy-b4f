import mayaImg from "../seed/images/Maya.jpg";
import mohamedImg from "../seed/images/Mohamed.jpg";
import molhamImg from "../seed/images/Molham.jpg";
import ramyImg from "../seed/images/Ramy.jpg";
import mustafaImg from "../seed/images/Mustafa.jpg";
import allaithImg from "../seed/images/Allaithjpg.jpg";
import "./about.css";

type TeamMember = {
  name: string;
  product: string;
  role: string;
  label: string;
  image?: string;
  emoji: string;
};

const team: TeamMember[] = [
  {
    name: "Molham",
    product: "Team Leader Jelly",
    role: "Team lead · Backend foundation, seed & integration",
    label: "Best before: last sprint",
    image: molhamImg,
    emoji: "🍮",
  },
  {
    name: "Ramy",
    product: "Homemade Molokhia",
    role: "Frontend layout, dashboard & pantry list",
    label: "ثيادتو",
    image: ramyImg,
    emoji: "🫙",
  },
  {
    name: "Maya",
    product: "Extra Virgin Olive Oil",
    role: "Frontend item form, details & use action",
    label: "First cold press: first to ship the task",
    image: mayaImg,
    emoji: "🫒",
  },
  {
    name: "Mohammad",
    product: "Fresh Tomato",
    role: "Frontend shopping list, shared API & types",
    label: "Goes well with every task",
    image: mohamedImg,
    emoji: "🍅",
  },
  {
    name: "Mustafa",
    product: "Summer Watermelon",
    role: "Backend pantry rules, statuses & dashboard",
    label: "Seeds: small bugs, taste not affected",
    image: mustafaImg,
    emoji: "🍉",
  },
  {
    name: "Allaith",
    product: "Developer Fuel – Dark Roast",
    role: "Backend shopping list, purchases & history",
    label: "100% Arabica + late night commits",
    image: allaithImg,
    emoji: "☕",
  },
];

export default function AboutPage() {
  return (
    <div className="about-page">
      <header className="about-hero">
        <p className="about-eyebrow">About us</p>
        <h1>Meet the team on the shelf</h1>
        <p>
          B Buy was built by six bootcamp developers at B4F. We help households
          know what they have before they buy more, so we put ourselves where
          we belong: in the pantry.
        </p>
      </header>

      <section className="about-shelf" aria-label="Team members">
        {team.map((member) => (
          <article className="about-product" key={member.name}>
            <div className="about-product-image">
              {member.image ? (
                <img
                  src={member.image}
                  alt={`${member.name} drawn as ${member.product}`}
                  loading="lazy"
                />
              ) : (
                <div className="about-product-placeholder" aria-hidden="true">
                  <span>{member.emoji}</span>
                  <small>Restocking soon</small>
                </div>
              )}
            </div>
            <div className="about-price-tag">
              <span className="about-product-name">{member.product}</span>
              <h2>{member.name}</h2>
              <p className="about-role">{member.role}</p>
              <p className="about-label" dir="auto">
                {member.label}
              </p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
