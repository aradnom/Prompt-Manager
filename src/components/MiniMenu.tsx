import { Link } from "react-router-dom";
import { useMenu } from "@/contexts/MenuContext";
import { AnimatedBorderButton } from "@/components/AnimatedBorderButton";
import { RasterIcon } from "@/components/RasterIcon";

const navItems = [
  { path: "/", icon: "home" },
  { path: "/prompts", icon: "chat" },
  { path: "/blocks", icon: "blocks" },
  { path: "/wildcards", icon: "dice" },
];

export function MiniMenu() {
  const { setIsOpen } = useMenu();

  return (
    <>
      <AnimatedBorderButton onClick={() => setIsOpen(true)} position="left">
        <div className="opacity-75 group-hover:opacity-100 transition-opacity duration-300">
          <RasterIcon name="menu" size={20} opacity={0.8} />
        </div>
      </AnimatedBorderButton>
      <nav className="fixed top-17 left-8 z-50 flex flex-col gap-4">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="opacity-75 transition-opacity hover:opacity-100"
          >
            <RasterIcon name={item.icon} size={20} opacity={0.8} />
          </Link>
        ))}
      </nav>
    </>
  );
}
