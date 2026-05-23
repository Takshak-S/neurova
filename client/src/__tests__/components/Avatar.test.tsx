import { render, screen } from "@testing-library/react";
import { Avatar } from "@/components/ui/Avatar";

describe("Avatar", () => {
    it("shows initials", () => {
        render(<Avatar name="Alice" />);
        expect(screen.getByText("A")).toBeInTheDocument();
    });

    it("shows ? when no name", () => {
        render(<Avatar />);
        expect(screen.getByText("?")).toBeInTheDocument();
    });

    it("renders img when src provided", () => {
        render(<Avatar src="https://x.com/a.png" name="Alice" />);
        expect(screen.getByRole("img")).toHaveAttribute("src", "https://x.com/a.png");
    });

    it("shows green dot when online", () => {
        const { container } = render(<Avatar name="Alice" isOnline={true} />);
        expect(container.querySelector(".bg-green-500")).toBeInTheDocument();
    });

    it("shows gray dot when offline", () => {
        const { container } = render(<Avatar name="Alice" isOnline={false} />);
        expect(container.querySelector(".bg-gray-400")).toBeInTheDocument();
    });

    it("hides dot when isOnline undefined", () => {
        const { container } = render(<Avatar name="Alice" />);
        expect(container.querySelector(".bg-green-500")).not.toBeInTheDocument();
    });
});