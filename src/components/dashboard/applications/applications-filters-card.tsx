import { Filter, Search } from "lucide-react";
import { DEFAULT_FILTERS } from "@/components/dashboard/applications/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PART_TYPES, PASS_STATUSES, type ApplicationFilters } from "@/types/application";

type Props = {
  filters: ApplicationFilters;
  totalLabel: string;
  onChangeFilters: (updater: (prev: ApplicationFilters) => ApplicationFilters) => void;
};

export function ApplicationsFiltersCard({ filters, totalLabel, onChangeFilters }: Props) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Filter className="h-5 w-5 text-[color:var(--accent)]" />
            Filters
          </CardTitle>
          <CardDescription>Filter applications by part, pass status, and submission conditions.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs font-medium text-[color:var(--muted-foreground)]">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[color:var(--muted-foreground)]" />
              <Input
                className="pl-9"
                placeholder="Name, major, university, phone"
                value={filters.q}
                onChange={(event) => onChangeFilters((prev) => ({ ...prev, q: event.target.value, page: 1 }))}
              />
            </div>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-[color:var(--muted-foreground)]">Part</span>
            <Select
              value={filters.part}
              onChange={(event) =>
                onChangeFilters((prev) => ({ ...prev, part: event.target.value as ApplicationFilters["part"], page: 1 }))
              }
            >
              <option value="ALL">ALL</option>
              {PART_TYPES.map((part) => (
                <option key={part} value={part}>
                  {part}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-[color:var(--muted-foreground)]">Pass Status</span>
            <Select
              value={filters.passStatus}
              onChange={(event) =>
                onChangeFilters((prev) => ({
                  ...prev,
                  passStatus: event.target.value as ApplicationFilters["passStatus"],
                  page: 1,
                }))
              }
            >
              <option value="ALL">ALL</option>
              {PASS_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-[color:var(--muted-foreground)]">Notion Exists</span>
            <Select
              value={filters.notionExists}
              onChange={(event) =>
                onChangeFilters((prev) => ({
                  ...prev,
                  notionExists: event.target.value as ApplicationFilters["notionExists"],
                  page: 1,
                }))
              }
            >
              <option value="all">ALL</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-[color:var(--muted-foreground)]">Generation ID</span>
            <Input
              inputMode="numeric"
              placeholder="e.g. 12"
              value={filters.generationId}
              onChange={(event) => onChangeFilters((prev) => ({ ...prev, generationId: event.target.value, page: 1 }))}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-[color:var(--muted-foreground)]">Submitted</span>
            <Select
              value={filters.submitted}
              onChange={(event) =>
                onChangeFilters((prev) => ({
                  ...prev,
                  submitted: event.target.value as ApplicationFilters["submitted"],
                  page: 1,
                }))
              }
            >
              <option value="all">ALL</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-[color:var(--muted-foreground)]">Enrolled</span>
            <Select
              value={filters.enrolled}
              onChange={(event) =>
                onChangeFilters((prev) => ({
                  ...prev,
                  enrolled: event.target.value as ApplicationFilters["enrolled"],
                  page: 1,
                }))
              }
            >
              <option value="all">ALL</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-[color:var(--muted-foreground)]">Submitted From</span>
            <Input
              type="date"
              value={filters.submittedFrom}
              onChange={(event) => onChangeFilters((prev) => ({ ...prev, submittedFrom: event.target.value, page: 1 }))}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-[color:var(--muted-foreground)]">Submitted To</span>
            <Input
              type="date"
              value={filters.submittedTo}
              onChange={(event) => onChangeFilters((prev) => ({ ...prev, submittedTo: event.target.value, page: 1 }))}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-[color:var(--muted-foreground)]">Total {totalLabel}</div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onChangeFilters(() => DEFAULT_FILTERS)}
            className="min-w-24"
            type="button"
          >
            Reset Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
