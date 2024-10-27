import React, { useState, useCallback } from "react";
import {
  Page,
  IndexTable,
  Card,
  TextField,
  Filters,
  Button,
  Pagination,
  Frame,
  Toast,
  useIndexResourceState,
  Badge,
  Thumbnail,
  LegacyCard,
  Modal,
} from "@shopify/polaris";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { apiVersion, authenticate } from "../shopify.server";
import "../styles/reward-points.css";

// GraphQL query để lấy danh sách sản phẩm
const query = `
  {
    products(first: 10) {
      edges {
        node {
          id
          title
          featuredImage {
            originalSrc
          }
          status
          totalInventory
          productType
          vendor
          collections(first: 1) {
            edges {
              node {
                title
              }
            }
          }
        }
      }
    }
  }
`;

// GraphQL mutation để xóa sản phẩm
const DELETE_PRODUCT_MUTATION = `
  mutation deleteProduct($id: ID!) {
    productDelete(input: { id: $id }) {
      deletedProductId
      userErrors {
        field
        message
      }
    }
  }
`;

// GraphQL mutation để sửa sản phẩm
const EDIT_PRODUCT_TITLE_MUTATION = `
  mutation updateProductTitle($id: ID!, $title: String!) {
    productUpdate(input: { id: $id, title: $title }) {
      product {
        id
        title
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Loader để lấy dữ liệu từ Shopify
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { shop, accessToken } = session;

  try {
    const response = await fetch(
      `https://${shop}/admin/api/${apiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query }),
      }
    );

    const result = await response.json();
    if (result.errors) {
      console.error("GraphQL Error:", result.errors);
      throw new Error(result.errors[0]?.message || "GraphQL query failed");
    }

    if (!result?.data?.products) {
      throw new Error("No products data found in response.");
    }

    return result.data.products.edges.map(({ node }) => ({
      id: node.id,
      name: node.title ?? "N/A",
      image: node.featuredImage?.originalSrc ?? "",
      status: node.status ?? "N/A",
      inventory: node.totalInventory ?? 0,
      type: node.productType ?? "N/A",
      vendor: node.vendor ?? "N/A",
      category: node.collections.edges[0]?.node?.title ?? "Uncategorized",
    }));
  } catch (error) {
    console.error("Error fetching products:", error);
    throw new Response("Failed to load products", { status: 500 });
  }
};

// Action để xử lý
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { shop, accessToken } = session;

  const formData = await request.formData();
  const actionType = formData.get("action");
  const productId = formData.get("id");

  if (actionType === "delete") {
    const response = await fetch(
      `https://${shop}/admin/api/${apiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query: DELETE_PRODUCT_MUTATION,
          variables: { id: productId },
        }),
      }
    );

    const result = await response.json();
    if (result.errors || result.data.productDelete.userErrors.length > 0) {
      console.error("Error deleting product:", result.errors);
      return { success: false, error: "Failed to delete product" };
    }

    return { success: true };
  } else if (actionType === "editTitle") {
    const newTitle = formData.get("title");
    const response = await fetch(
      `https://${shop}/admin/api/${apiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query: EDIT_PRODUCT_TITLE_MUTATION,
          variables: { id: productId, title: newTitle },
        }),
      }
    );

    const result = await response.json();
    if (result.errors || result.data.productUpdate.userErrors.length > 0) {
      console.error("Error updating product title:", result.errors);
      return { success: false, error: "Failed to update product title" };
    }

    return { success: true };
  }
};

function ProductsPage() {
  const productsData = useLoaderData();
  const fetcher = useFetcher();
  const [products, setProducts] = useState(productsData);
  const [showToast, setShowToast] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [filteredProducts, setFilteredProducts] = useState(productsData);

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(filteredProducts);

  // Hiển thị modal xác nhận xóa
  const handleDeleteClick = (id) => {
    setProductToEdit(id);
    setShowModal(true);
  };

  // Xác nhận xóa sản phẩm
  const confirmDelete = useCallback(() => {
    if (!productToEdit) return;
    fetcher.submit(
      { id: productToEdit, action: "delete" },
      { method: "post", action: "/app/products" }
    );

    setProducts((prev) => prev.filter((product) => product.id !== productToEdit));
    setFilteredProducts((prev) => prev.filter((product) => product.id !== productToEdit));
    setShowToast(true);
    setShowModal(false);
    setProductToEdit(null);
  }, [fetcher, productToEdit]);

  // Hiển thị modal sửa
  const handleEditClick = (product) => {
    setProductToEdit(product.id);
    setEditTitle(product.name);
    setShowEditModal(true);
  };

  // Xác nhận sửa title
  const confirmEdit = useCallback(() => {
    if (!productToEdit || !editTitle) return;
    fetcher.submit(
      { id: productToEdit, title: editTitle, action: "editTitle" },
      { method: "post", action: "/app/products" }
    );

    setProducts((prev) =>
      prev.map((product) =>
        product.id === productToEdit ? { ...product, name: editTitle } : product
      )
    );
    setFilteredProducts((prev) =>
      prev.map((product) =>
        product.id === productToEdit ? { ...product, name: editTitle } : product
      )
    );
    setShowToast(true);
    setShowEditModal(false);
    setProductToEdit(null);
  }, [fetcher, productToEdit, editTitle]);

  const handleSearch = useCallback(
    (value) => {
      setSearchValue(value);
      const searchResult = products.filter((product) =>
        product.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredProducts(searchResult);
    },
    [products]
  );

  const rowMarkup = filteredProducts.map(
    ({ id, name, image, status, inventory, type, vendor, category }, index) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
      >
        <IndexTable.Cell>{index + 1}</IndexTable.Cell>
        <IndexTable.Cell>
          <Thumbnail source={image} alt={name} size="small" />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge>{name}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>{status}</IndexTable.Cell>
        <IndexTable.Cell>{inventory}</IndexTable.Cell>
        <IndexTable.Cell>{category}</IndexTable.Cell>
        <IndexTable.Cell>{type}</IndexTable.Cell>
        <IndexTable.Cell>{vendor}</IndexTable.Cell>
        <IndexTable.Cell>
          <Button onClick={() => handleEditClick({ id, name })}>Edit</Button>
          <Button onClick={() => handleDeleteClick(id)} destructive>
            Delete
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  );

  return (
    <Frame>
      <Page fullWidth title="Products">
        <Card sectioned>
          <Filters
            queryValue={searchValue}
            onQueryChange={handleSearch}
            onQueryClear={() => handleSearch("")}
            filters={[]}
          >
            <div style={{ paddingLeft: "8px" }}>
              <Button primary>Add Product</Button>
            </div>
          </Filters>
        </Card>

        <LegacyCard>
          <IndexTable
            resourceName={{ singular: "product", plural: "products" }}
            itemCount={filteredProducts.length}
            selectedItemsCount={
              allResourcesSelected ? "All" : selectedResources.length
            }
            onSelectionChange={handleSelectionChange}
            headings={[
              { title: "ID" },
              { title: "Image" },
              { title: "Name" },
              { title: "Status" },
              { title: "Inventory" },
              { title: "Category" },
              { title: "Type" },
              { title: "Vendor" },
              { title: "Actions" },
            ]}
          >
            {rowMarkup}
          </IndexTable>
        </LegacyCard>

        <Pagination
          hasPrevious
          hasNext
          onPrevious={() => console.log("Previous page")}
          onNext={() => console.log("Next page")}
        />

        {showToast && (
          <Toast
            content="Action completed successfully"
            onDismiss={() => setShowToast(false)}
          />
        )}

        {showModal && (
          <Modal
            open={showModal}
            onClose={() => setShowModal(false)}
            title="Delete Product"
            primaryAction={{
              content: "Confirm",
              destructive: true,
              onAction: confirmDelete,
            }}
            secondaryActions={[
              {
                content: "Cancel",
                onAction: () => setShowModal(false),
              },
            ]}
          >
            <Modal.Section>
              <p>Are you sure you want to delete this product? This action cannot be undone.</p>
            </Modal.Section>
          </Modal>
        )}

        {showEditModal && (
          <Modal
            open={showEditModal}
            onClose={() => setShowEditModal(false)}
            title="Edit Product Title"
            primaryAction={{
              content: "Save",
              onAction: confirmEdit,
            }}
            secondaryActions={[
              {
                content: "Cancel",
                onAction: () => setShowEditModal(false),
              },
            ]}
          >
            <Modal.Section>
              <TextField
                label="Product Title"
                value={editTitle}
                onChange={setEditTitle}
                autoComplete="off"
              />
            </Modal.Section>
          </Modal>
        )}
      </Page>
    </Frame>
  );
}

export default ProductsPage;
