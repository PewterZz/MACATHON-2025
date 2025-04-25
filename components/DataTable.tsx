"use client"

import type React from "react"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react"

interface Column {
  accessorKey?: string
  header: string
  id?: string
  cell?: (info: any) => React.ReactNode
}

interface DataTableProps {
  columns: Column[]
  data: any[]
}

export function DataTable({ columns, data }: DataTableProps) {
  const [sorting, setSorting] = useState<{ id: string; desc: boolean } | null>(null)

  const sortedData = sorting
    ? [...data].sort((a, b) => {
        const column = sorting.id
        const aValue = a[column]
        const bValue = b[column]

        const result = aValue > bValue ? 1 : aValue < bValue ? -1 : 0
        return sorting.desc ? -result : result
      })
    : data

  const handleSort = (columnId: string) => {
    setSorting((prev) => {
      if (prev?.id !== columnId) return { id: columnId, desc: false }
      if (prev.desc) return null
      return { id: columnId, desc: true }
    })
  }

  const getSortIcon = (columnId: string) => {
    if (sorting?.id !== columnId) return <ChevronsUpDown className="h-4 w-4" />
    return sorting.desc ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />
  }

  return (
    <div className="rounded-md border border-slate-700 overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-800">
          <TableRow className="hover:bg-slate-800/50 border-slate-700">
            {columns.map((column) => (
              <TableHead key={column.id || column.accessorKey} className="text-slate-300">
                {column.accessorKey ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-0 h-auto font-medium hover:bg-transparent hover:text-slate-100 text-slate-300"
                    onClick={() => handleSort(column.accessorKey!)}
                  >
                    {column.header}
                    <span className="ml-2">{getSortIcon(column.accessorKey)}</span>
                  </Button>
                ) : (
                  column.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.length > 0 ? (
            sortedData.map((row) => (
              <TableRow key={row.id} className="hover:bg-slate-800/50 border-slate-700">
                {columns.map((column) => (
                  <TableCell key={column.id || column.accessorKey} className="text-slate-300">
                    {column.cell ? column.cell(row) : column.accessorKey ? row[column.accessorKey] : null}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-slate-400">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
