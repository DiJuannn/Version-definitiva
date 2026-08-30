import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles, colors } from "@/lib/pdf/styles";

function currency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

type BudgetCategoryWithItems = {
  id: string;
  name: string;
  items: {
    id: string;
    description: string;
    quantity: unknown;
    unitPrice: unknown;
    taxRate: unknown;
  }[];
};

export function BudgetDocument({
  projectName,
  categories,
}: {
  projectName: string;
  categories: BudgetCategoryWithItems[];
}) {
  const categoriesWithTotals = categories.map((category) => {
    const rows = category.items.map((item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const taxRate = Number(item.taxRate);
      const subtotal = quantity * unitPrice;
      const total = subtotal * (1 + taxRate / 100);
      return { ...item, quantity, unitPrice, taxRate, total };
    });
    const categoryTotal = rows.reduce((sum, item) => sum + item.total, 0);
    return { ...category, rows, categoryTotal };
  });

  const grandTotal = categoriesWithTotals.reduce(
    (sum, category) => sum + category.categoryTotal,
    0,
  );

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <View>
            <Text style={pdfStyles.eyebrow}>Presupuesto</Text>
            <Text style={pdfStyles.title}>{projectName}</Text>
          </View>
        </View>

        {categoriesWithTotals.map((category) => {
          const { rows, categoryTotal } = category;

          return (
            <View key={category.id} style={pdfStyles.section} wrap={false}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <Text style={pdfStyles.sectionLabel}>{category.name}</Text>
                <Text style={[pdfStyles.sectionLabel, { color: colors.accent }]}>
                  {currency(categoryTotal)}
                </Text>
              </View>
              <View style={pdfStyles.rowHeader}>
                <Text style={[pdfStyles.th, { flex: 1 }]}>Concepto</Text>
                <Text style={[pdfStyles.th, { width: 50 }]}>Cant.</Text>
                <Text style={[pdfStyles.th, { width: 70 }]}>Precio</Text>
                <Text style={[pdfStyles.th, { width: 40 }]}>IVA</Text>
                <Text style={[pdfStyles.th, { width: 70 }]}>Total</Text>
              </View>
              {rows.map((item) => (
                <View key={item.id} style={pdfStyles.row}>
                  <Text style={[pdfStyles.td, { flex: 1 }]}>{item.description}</Text>
                  <Text style={[pdfStyles.td, { width: 50 }]}>{item.quantity}</Text>
                  <Text style={[pdfStyles.td, { width: 70 }]}>
                    {currency(item.unitPrice)}
                  </Text>
                  <Text style={[pdfStyles.td, { width: 40 }]}>{item.taxRate}%</Text>
                  <Text style={[pdfStyles.td, { width: 70 }]}>
                    {currency(item.total)}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            borderTopWidth: 1.5,
            borderTopColor: colors.ink,
            paddingTop: 8,
            marginTop: 8,
          }}
        >
          <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold" }}>TOTAL</Text>
          <Text
            style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: colors.accent }}
          >
            {currency(grandTotal)}
          </Text>
        </View>

        <View style={pdfStyles.footer} fixed>
          <Text>Versión definitiva — Taller</Text>
          <Text
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
