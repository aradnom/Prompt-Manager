import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMenu } from "@/contexts/MenuContext";
import { DotDivider } from "@/components/ui/dot-divider";
import { MainMenuBorder } from "@/components/MainMenuBorder";
import { MiniMenu } from "@/components/MiniMenu";
import { RasterIcon } from "@/components/RasterIcon";
import { useSession } from "@/contexts/SessionContext";

export function MainMenu() {
  const { isOpen: open, setIsOpen: setOpen } = useMenu();
  const location = useLocation();
  const { isAdmin } = useSession();

  type MenuItem = {
    path: string;
    label: string;
    icon: string;
    disabled?: boolean;
  };

  const menuSections: (MenuItem[] | "divider")[] = [
    [{ path: "/", label: "Home", icon: "home" }],
    "divider",
    [
      { path: "/prompts", label: "Prompts", icon: "chat" },
      { path: "/blocks", label: "Blocks", icon: "blocks" },
      { path: "/wildcards", label: "Wildcards", icon: "dice" },
    ],
    "divider",
    [
      { path: "/account", label: "Account", icon: "user" },
      {
        path: "/what-is-this",
        label: "What is This Thing?",
        icon: "question-mark",
      },
      ...(isAdmin
        ? [
            {
              path: "/developer-settings",
              label: "Developer Settings",
              icon: "gear",
            },
          ]
        : []),
    ],
  ];

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <MiniMenu />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-64 inset-y-0 left-0 h-full border-none radial-gradient-cyan"
          bgOpacity={0.7}
        >
          <div className="absolute w-full h-full top-0 left-0 -z-1 film-grain opacity-20" />
          <MainMenuBorder isOpen={open} />
          <SheetHeader>
            <SheetTitle className="sr-only">Main Menu</SheetTitle>
          </SheetHeader>
          <nav className="mt-8 flex flex-col gap-2">
            {menuSections.map((section, i) =>
              section === "divider" ? (
                <DotDivider key={`divider-${i}`} />
              ) : (
                section.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => !item.disabled && setOpen(false)}
                    className={`block ${
                      item.disabled ? "pointer-events-none opacity-50" : ""
                    }`}
                  >
                    <Button
                      variant={isActive(item.path) ? "default" : "ghost"}
                      className="w-full justify-start hover:bg-cyan-medium/30"
                      disabled={item.disabled}
                    >
                      {item.icon && (
                        <RasterIcon
                          name={item.icon}
                          size={20}
                          className="mr-2"
                        />
                      )}
                      {item.label}
                      {item.disabled && (
                        <span className="ml-auto text-xs text-cyan-medium">
                          Soon
                        </span>
                      )}
                    </Button>
                  </Link>
                ))
              ),
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
