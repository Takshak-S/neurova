import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
    it("renders children", () => {
        render(<Button>Click me </Button>);
        expect(screen.getByText("Click me")).toBeInTheDocument();
    });

    it("shows spinner when loading", () => {
        const { container } = render(<Button loading > Click </Button>);
        expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    });

    it("is disabled when loading", () => {
        render(<Button loading > Click </Button>);
        expect(screen.getByRole("button")).toBeDisabled();
    });

    it("is disabled when disabled prop", () => {
        render(<Button disabled > Click </Button>);
        expect(screen.getByRole("button")).toBeDisabled();
    });

    it("calls onClick", () => {
        const fn = jest.fn();
        render(<Button onClick={ fn } > Click </Button>);
        fireEvent.click(screen.getByRole("button"));
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("does not call onClick when disabled", () => {
        const fn = jest.fn();
        render(<Button disabled onClick = { fn } > Click </Button>);
        fireEvent.click(screen.getByRole("button"));
        expect(fn).not.toHaveBeenCalled();
    });
});
